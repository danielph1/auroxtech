import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {leadAcessivel} from '@/lib/lead-access';
import {modulosDisponiveis} from '@/lib/aurox-modulos-server';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(d:object,s=200)=>NextResponse.json(d,{status:s,headers:{'Cache-Control':'private, no-store'}});
type Ctx={params:Promise<{leadId:string}>};
export async function POST(req:NextRequest,{params}:Ctx){
 const actor=await requireUser(req),leadId=Number((await params).leadId);
 if(!actor||!Number.isSafeInteger(leadId)||leadId<=0)return json({error:'Acesso negado'},403);
 if(!['vendedor','gerente','admin','superadmin'].includes(actor.tipo))return json({error:'Sem permissão para enviar fichas'},403);
 const lead=await leadAcessivel(actor,leadId);
 if(!lead?.empresaId||!lead.vendedor_id)return json({error:'Lead sem vendedor responsável ou fora do escopo'},403);
 if(actor.tipo!=='superadmin'&&!((await modulosDisponiveis(actor)).includes('crm')))return json({error:'CRM não contratado'},403);
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const valid=await db.query(`SELECT l.id,l.empresa_id,l.vendedor_id,l.telefone,l.valor_entrada,l.valor_carro
   FROM public.leads l JOIN public.vendedores v ON v.id=l.vendedor_id AND v.empresa_id=l.empresa_id
   JOIN public.empresas e ON e.id=l.empresa_id AND e.ativo=TRUE
   WHERE l.id=$1 AND l.empresa_id=$2 AND l.vendedor_id=$3 FOR UPDATE OF l`,[leadId,lead.empresaId,lead.vendedor_id]);
  if(!valid.rowCount){await db.query('ROLLBACK');return json({error:'Lead alterado ou fora do escopo'},403)}
  const old=await db.query('SELECT id FROM public.fichas_credito WHERE lead_id=$1 ORDER BY id LIMIT 1',[leadId]);
  if(old.rowCount){await db.query('COMMIT');return json({ficha_id:Number(old.rows[0].id),criada:false})}
  const record=valid.rows[0];
  const result=await db.query(`INSERT INTO public.fichas_credito
   (lead_id,vendedor_id,criado_por_id,valor_entrada,valor_veiculo,status_geral)
   VALUES($1,$2,$3,$4,$5,'pendente') RETURNING id`,[leadId,lead.vendedor_id,actor.id,record.valor_entrada||0,record.valor_carro||0]);
  await db.query(`UPDATE public.leads SET gerou_ficha=TRUE WHERE id=$1 AND empresa_id=$2`,[leadId,lead.empresaId]);
  await db.query('COMMIT');return json({ficha_id:Number(result.rows[0].id),criada:true},201);
 }catch(e:any){await db.query('ROLLBACK').catch(()=>{});if(e?.code==='23505')return json({error:'Ficha criada simultaneamente. Abra novamente.'},409);return json({error:'Não foi possível preparar a ficha'},503)}
 finally{db.release()}
}
