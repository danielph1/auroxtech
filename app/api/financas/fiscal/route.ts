import {NextRequest,NextResponse} from 'next/server';
import {query,queryOne,getPool} from '@/lib/db';
import {financeAuth} from '@/lib/financas/finance';
import {verifyPassword} from '@/lib/password';
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
  FROM public.aurox_fiscal_simulacoes WHERE empresa_id=$1 AND excluido_em IS NULL ORDER BY criado_em DESC,id DESC LIMIT 30`,[auth.empresaId]);
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

/** Exclui da visualizacao, mas preserva auditoria minima. NUNCA usa empresa do cliente como autorizacao. */
export async function DELETE(req:NextRequest){
 const body=await req.json().catch(()=>null);
 const auth=await financeAuth(req,body?.empresa_id);
 if(auth instanceof NextResponse)return auth;
 const id=Number(body?.id);
 const todos=body?.escopo==='todos';
 const senha=typeof body?.senha==='string'?body.senha:'';
 if(!body || !senha || senha.length>200 || (todos ? body.confirmacao!=='APAGAR HISTORICO' : !Number.isSafeInteger(id)||id<1))
  return json({error:'Informe a senha e confirme a exclusão corretamente'},400);
 if(!['superadmin','admin'].includes(auth.actor.tipo))return json({error:'Apenas administradores podem remover simulações'},403);
 let client;
 try{
  if(!await acessoModulo(auth.empresaId))return json({error:'Módulo Fiscal não contratado nesta empresa'},403);
  client=await getPool().connect();
  await client.query('BEGIN');
  // Limite de tentativas por usuario/empresa, inclusive entre instancias Vercel.
  await client.query(`INSERT INTO public.aurox_fiscal_exclusao_tentativas(empresa_id,usuario_id)
    VALUES($1,$2) ON CONFLICT(empresa_id,usuario_id) DO NOTHING`,[auth.empresaId,auth.actor.id]);
  const {rows:[tentativa]}=await client.query(`
    SELECT falhas,(atualizado_em > now()-interval '15 minutes') AS janela_ativa
    FROM public.aurox_fiscal_exclusao_tentativas
    WHERE empresa_id=$1 AND usuario_id=$2 FOR UPDATE`,[auth.empresaId,auth.actor.id]);
  if(tentativa?.janela_ativa && Number(tentativa.falhas)>=5){
   await client.query('COMMIT');return json({error:'Muitas tentativas de senha. Aguarde 15 minutos.'},429);
  }
  const {rows:[usr]}=await client.query(`
    SELECT senha_hash FROM public.usuarios WHERE id=$1 AND COALESCE(ativo,true)=true FOR SHARE`,[auth.actor.id]);
  if(!usr || !verifyPassword(senha,usr.senha_hash)){
   await client.query(`UPDATE public.aurox_fiscal_exclusao_tentativas SET
    falhas=CASE WHEN atualizado_em<now()-interval '15 minutes' THEN 1 ELSE falhas+1 END,
    atualizado_em=now() WHERE empresa_id=$1 AND usuario_id=$2`,[auth.empresaId,auth.actor.id]);
   await client.query('COMMIT');return json({error:'Senha incorreta'},403);
  }
  await client.query(`UPDATE public.aurox_fiscal_exclusao_tentativas
    SET falhas=0,atualizado_em=now()-interval '1 second'
    WHERE empresa_id=$1 AND usuario_id=$2`,[auth.empresaId,auth.actor.id]);
  const updated=todos
   ?await client.query(`UPDATE public.aurox_fiscal_simulacoes
      SET excluido_em=now(),excluido_por=$2 WHERE empresa_id=$1 AND excluido_em IS NULL RETURNING id`,
      [auth.empresaId,auth.actor.id])
   :await client.query(`UPDATE public.aurox_fiscal_simulacoes
      SET excluido_em=now(),excluido_por=$3 WHERE empresa_id=$1 AND id=$2 AND excluido_em IS NULL RETURNING id`,
      [auth.empresaId,id,auth.actor.id]);
  const quantidade=updated.rowCount||0;
  if(!quantidade && !todos){await client.query('COMMIT');return json({error:'Simulação não encontrada nesta empresa'},404);}
  if(quantidade){
   await client.query(`INSERT INTO public.aurox_fiscal_auditoria
    (empresa_id,simulacao_id,ator_id,evento,quantidade) VALUES($1,$2,$3,$4,$5)`,
    [auth.empresaId,todos?null:id,auth.actor.id,todos?'limpar_historico':'remover_simulacao',quantidade]);
  }
  await client.query('COMMIT');
  return json({ok:true,removidas:quantidade,notificacao:'Simulações retiradas do histórico; auditoria preservada.'});
 }catch(e:any){
  if(client)await client.query('ROLLBACK').catch(()=>{});
  console.error('[fiscal DELETE]',String(e?.code||'erro'));
  return json({error:['42P01','42703'].includes(String(e?.code))?'Execute a migração Fiscal de exclusão no Supabase.':'Não foi possível remover a simulação'},503);
 }finally{if(client)client.release();}
}
