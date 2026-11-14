import {NextRequest,NextResponse} from 'next/server';
import {getPool,query,queryOne} from '@/lib/db';
import {requireUser} from '@/lib/session';
export const runtime='nodejs';export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store'};
const isManager=(role:string)=>['superadmin','admin','gerente'].includes(role);
const positive=(x:unknown)=>{const n=Number(x);return Number.isSafeInteger(n)&&n>0?n:0};
// API de progresso individual: não sobrescreve a conclusão global do gestor.
export async function GET(req:NextRequest){
 const u=await requireUser(req);if(!u)return NextResponse.json({error:'Não autenticado'},{status:401});
 const ids=String(req.nextUrl.searchParams.get('ids')||'').split(',').map(positive).filter(Boolean).slice(0,100);
 if(!ids.length)return NextResponse.json([],{headers:noStore});
 try{
  const role=String(u.tipo||'').toLowerCase();const args:unknown[]=[ids];
  let scope='m.id=ANY($1::bigint[]) AND m.empresa_id IS NOT NULL';
  if(role!=='superadmin'){
   if(!positive(u.empresa_id))return NextResponse.json([],{headers:noStore});
   args.push(u.empresa_id);scope+=` AND m.empresa_id=$${args.length}`;
  }
  if(role==='gerente'){
   args.push(u.loja||'');scope+=` AND UPPER(COALESCE(usr.loja,''))=UPPER($${args.length}) AND (m.destinatario_loja IS NULL OR UPPER(m.destinatario_loja)=UPPER($${args.length}))`;
  }
  const isMgr=isManager(role);
  if(!isMgr){args.push(u.id);scope+=` AND r.usuario_id=$${args.length}`;}
  const {rows}=await query(`SELECT r.meta_id,r.usuario_id,r.concluida,r.observacao,r.updated_at,usr.nome AS colaborador
   FROM public.manu_metas_respostas r JOIN public.metas m ON m.id=r.meta_id AND m.empresa_id=r.empresa_id
   JOIN public.usuarios usr ON usr.id=r.usuario_id AND usr.empresa_id=r.empresa_id
   WHERE ${scope} ORDER BY r.updated_at DESC LIMIT 300`,args);
  return NextResponse.json(rows,{headers:noStore});
 }catch(e){console.error('[metas respostas GET]',e instanceof Error?e.message:'erro');return NextResponse.json({error:'Histórico de metas indisponível. Execute a migração de respostas.'},{status:503});}
}
export async function PATCH(req:NextRequest){
 const u=await requireUser(req);if(!u)return NextResponse.json({error:'Não autenticado'},{status:401});
 const b=await req.json().catch(()=>null);const id=positive(b?.meta_id);const role=String(u.tipo||'').toLowerCase();
 if(!id||typeof b?.concluida!=='boolean'||typeof b?.observacao!=='string'||b.observacao.length>2000)
  return NextResponse.json({error:'Informe meta, conclusão e observação válida (até 2000 caracteres)'},{status:400});
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const {rows:[m]}=await db.query<{id:number;empresa_id:number|null;destinatario_id:number|null;destinatario_tipo:string|null;destinatario_loja:string|null}>(
    `SELECT id,empresa_id,destinatario_id,destinatario_tipo,destinatario_loja FROM public.metas WHERE id=$1 AND COALESCE(ativo,TRUE)=TRUE FOR SHARE`,[id]);
  if(!m?.empresa_id||(role!=='superadmin'&&Number(m.empresa_id)!==Number(u.empresa_id))){await db.query('ROLLBACK');return NextResponse.json({error:'Meta de outra empresa ou inexistente'},{status:403});}
  const targeted=Number(m.destinatario_id||0)===Number(u.id)||(
    !m.destinatario_id && (
      (m.destinatario_tipo&&m.destinatario_tipo.toLowerCase()===role&&(!m.destinatario_loja||m.destinatario_loja.toUpperCase()===String(u.loja||'').toUpperCase()))||
      (!m.destinatario_tipo&&m.destinatario_loja&&m.destinatario_loja.toUpperCase()===String(u.loja||'').toUpperCase())
    )
  );
  if(!targeted){await db.query('ROLLBACK');return NextResponse.json({error:'Você não é o destinatário desta meta'},{status:403});}
  await db.query(`INSERT INTO public.manu_metas_respostas(empresa_id,meta_id,usuario_id,concluida,observacao,updated_at)
    VALUES($1,$2,$3,$4,$5,NOW()) ON CONFLICT(empresa_id,meta_id,usuario_id) DO UPDATE
    SET concluida=EXCLUDED.concluida,observacao=EXCLUDED.observacao,updated_at=NOW()`,
    [m.empresa_id,id,u.id,b.concluida,String(b.observacao).trim()]);
  await db.query('COMMIT');return NextResponse.json({ok:true},{headers:noStore});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('[metas respostas PATCH]',e instanceof Error?e.message:'erro');return NextResponse.json({error:'Não foi possível salvar resposta da meta'},{status:503});}
 finally{db.release()}
}
