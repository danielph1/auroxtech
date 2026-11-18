import {NextRequest,NextResponse} from 'next/server';
import {query,queryOne} from '@/lib/db';
import {financeAuth} from '@/lib/financas/finance';
import {calcularFiscal,emCentavos,type DadosFiscais} from '@/lib/fiscal/calculo';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(v:object,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
async function acessoModulo(empresaId:number){
 const r=await queryOne<{ativo:boolean}>(`SELECT EXISTS (SELECT 1 FROM public.aurox_contrato_servicos f JOIN public.aurox_contrato_servicos fin ON fin.empresa_id=f.empresa_id AND fin.codigo='financeiro' AND fin.ativo=TRUE WHERE f.empresa_id=$1 AND f.codigo='fiscal' AND f.ativo=TRUE) AS ativo`,[empresaId]);
 return r?.ativo===true;
}
export async function GET(req:NextRequest){
 const auth=await financeAuth(req,req.nextUrl.searchParams.get('empresa_id'));
 if(auth instanceof NextResponse)return auth;
 try{
  const habilitado=await acessoModulo(auth.empresaId);
  if(!habilitado)return json({habilitado:false,simulacoes:[]});
  const {rows}=await query(`SELECT id,regime,base,descricao,venda_centavos,aquisicao_centavos,despesas_centavos,
  base_calculo_centavos,aliquota_percentual,estimado_centavos,margem_centavos,criado_em
  FROM public.aurox_fiscal_simulacoes WHERE empresa_id=$1 ORDER BY criado_em DESC,id DESC LIMIT 30`,[auth.empresaId]);
  return json({habilitado:true,simulacoes:rows});
 }catch(e:any){return json({error:e?.code==='42P01'?'Execute a migration Fiscal no Supabase':'Falha ao consultar Fiscal'},503)}
}
export async function POST(req:NextRequest){
 const b=await req.json().catch(()=>null);
 const auth=await financeAuth(req,b?.empresa_id);
 if(auth instanceof NextResponse)return auth;
 if(!b)return json({error:'Informe os dados para simulação'},400);
 try{
  if(!await acessoModulo(auth.empresaId))return json({error:'O módulo Fiscal e Tributos não foi contratado por esta empresa'},403);
  const taxa=String(b.aliquota??'').trim();
  if(!/^\d{1,3}(?:[,.]\d{1,4})?$/.test(taxa))return json({error:'Informe alíquota percentual válida com até quatro casas decimais'},400);
  const d:DadosFiscais={regime:b.regime,base:b.base,
   valor_venda_centavos:emCentavos(b.venda),
   custo_aquisicao_centavos:emCentavos(b.aquisicao||'0'),
   despesas_centavos:emCentavos(b.despesas||'0'),
   ...(b.base==='manual'?{base_manual_centavos:emCentavos(b.base_manual)}:{}),
   aliquota_percentual:Number(taxa.replace(',','.'))};
  const resultado=calcularFiscal(d);
  const descricao=String(b.descricao||'').trim().slice(0,200);
  const saved=await queryOne<{id:string}>(`INSERT INTO public.aurox_fiscal_simulacoes
   (empresa_id,usuario_id,regime,base,descricao,venda_centavos,aquisicao_centavos,despesas_centavos,
    base_calculo_centavos,aliquota_percentual,estimado_centavos,margem_centavos)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
   [auth.empresaId,auth.actor.id,d.regime,d.base,descricao,d.valor_venda_centavos,
    d.custo_aquisicao_centavos,d.despesas_centavos,resultado.base_calculo_centavos,
    d.aliquota_percentual,resultado.tributo_estimado_centavos,resultado.margem_apos_tributo_centavos]);
  return json({ok:true,id:saved?.id,resultado,alerta:'Não gera impostos a pagar nem movimentos no caixa.'},201);
 }catch(e:any){
  if(e?.code==='42P01')return json({error:'Execute a migration Fiscal no Supabase'},503);
  if(e instanceof Error&&!e?.code)return json({error:e.message},400);
  return json({error:'Não foi possível registrar a simulação'},503);
 }
}
