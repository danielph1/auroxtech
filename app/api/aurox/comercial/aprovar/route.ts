import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
import {isSuperAdmin} from '@/lib/tenant';
import {verifyPassword} from '@/lib/password';
import {getPool} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(x:object,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});
/** Aceite comercial NÃO cria conta nem usa a confirmação do frontend como autorização. */
export async function POST(req:NextRequest){
 const actor=await requireUser(req);
 if(!actor||!isSuperAdmin(actor))return json({error:'Apenas superadmin'},403);
 const body=await req.json().catch(()=>null);
 const id=Number(body?.id),senha=String(body?.senha||'');
 if(!Number.isSafeInteger(id)||id<=0||!senha||senha.length>200)return json({error:'ID e senha obrigatórios'},400);
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const {rows:[admin]}=await db.query(`SELECT senha_hash FROM public.usuarios WHERE id=$1 AND tipo='superadmin' AND ativo=true FOR SHARE`,[actor.id]);
  if(!admin||!verifyPassword(senha,admin.senha_hash)){await db.query('ROLLBACK');return json({error:'Senha do superadmin incorreta'},403)}
  const {rows:[item]}=await db.query(`SELECT s.id,s.status FROM public.aurox_solicitacoes_comerciais s JOIN public.empresas e ON e.id=s.empresa_id AND e.slug='aurox-plataforma' WHERE s.id=$1 FOR UPDATE OF s`,[id]);
  if(!item){await db.query('ROLLBACK');return json({error:'Solicitação não encontrada na AUROX'},404)}
  if(item.status==='descartado'){await db.query('ROLLBACK');return json({error:'Solicitação descartada: reabra antes de aprovar'},409)}
  const {rows:[approved]}=await db.query(`UPDATE public.aurox_solicitacoes_comerciais SET status='aprovado',aprovado_em=COALESCE(aprovado_em,now()),aprovado_por=COALESCE(aprovado_por,$2),atualizado_por=$2,atualizado_em=now() WHERE id=$1 RETURNING id,status,aprovado_em`,[id,actor.id]);
  await db.query('COMMIT');return json({ok:true,solicitacao:approved});
 }catch(e:any){await db.query('ROLLBACK').catch(()=>{});console.error('[aurox/comercial/aprovar]',{code:String(e?.code||'erro')});return json({error:'Falha ao aprovar a proposta. Confira as migrations comerciais.'},503)}
 finally{db.release()}
}
