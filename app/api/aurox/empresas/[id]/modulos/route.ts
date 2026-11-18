import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
import {isSuperAdmin} from '@/lib/tenant';
import {getPool} from '@/lib/db';
import {AUROX_MODULOS_PUBLICOS,AUROX_BASE_CENTAVOS,cotarAurox,normalizarModulosAurox} from '@/lib/aurox-precos-publicos';
export const runtime='nodejs';
const json=(v:object,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function PUT(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await requireUser(req);if(!actor||!isSuperAdmin(actor))return json({error:'Apenas superadmin'},403);
 const {id}=await params;const empresaId=Number(id);const b=await req.json().catch(()=>null);
 const ids=new Set(AUROX_MODULOS_PUBLICOS.map(x=>x.id));const entrada=b?.modulos;
 if(!Number.isSafeInteger(empresaId)||empresaId<=0||!Array.isArray(entrada)||entrada.length>ids.size||entrada.some((x:unknown)=>typeof x!=='string'||!ids.has(x)))return json({error:'Empresa ou módulos inválidos'},400);
 const modulos=normalizarModulosAurox(Array.from(new Set(entrada as string[])));const valor=cotarAurox(modulos);
 const db=await getPool().connect();try{await db.query('BEGIN');
  const {rows:[empresa]}=await db.query(`SELECT id,slug FROM public.empresas WHERE id=$1 FOR UPDATE`,[empresaId]);
  if(!empresa||empresa.slug==='aurox-plataforma'){await db.query('ROLLBACK');return json({error:'Empresa não encontrada ou protegida'},403)}
  await db.query(`INSERT INTO public.aurox_contratos_comerciais(empresa_id,status,plano_base,base_mensal_centavos,criado_por,promo_desconto_porcento)
   VALUES($1,'rascunho','black',$2,$3,25) ON CONFLICT(empresa_id) DO UPDATE SET atualizado_em=now()`,[empresaId,AUROX_BASE_CENTAVOS,actor.id]);
  for(const m of AUROX_MODULOS_PUBLICOS){
   const ativo=modulos.includes(m.id);
   await db.query(`INSERT INTO public.aurox_contrato_servicos(empresa_id,codigo,ativo,preco_mensal_centavos,quantidade,incluido_ate,atualizado_por,ativado_em)
    VALUES($1,$2,$3,$4,1,1,$5,CASE WHEN $3 THEN now() ELSE NULL END)
    ON CONFLICT(empresa_id,codigo) DO UPDATE SET ativo=EXCLUDED.ativo,preco_mensal_centavos=EXCLUDED.preco_mensal_centavos,
    atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now(),ativado_em=CASE WHEN EXCLUDED.ativo THEN COALESCE(aurox_contrato_servicos.ativado_em,now()) ELSE NULL END,
    desativado_em=CASE WHEN EXCLUDED.ativo THEN NULL ELSE now() END`,[empresaId,m.id,ativo,m.centavos,actor.id]);
  }
  await db.query(`INSERT INTO public.aurox_eventos_contrato(empresa_id,ator_id,evento,dados)
   VALUES($1,$2,'modulos_atualizados',$3::jsonb)`,[empresaId,actor.id,JSON.stringify({modulos,normal_centavos:valor.normalCentavos})]);
  await db.query('COMMIT');return json({ok:true,modulos,...valor});
 }catch(e:any){await db.query('ROLLBACK').catch(()=>{});console.error('[modulos PUT]',{code:String(e?.code||'erro')});return json({error:'Não foi possível salvar módulos; confira as migrações.'},503)}finally{db.release()}
}
