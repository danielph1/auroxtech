import {NextRequest,NextResponse} from 'next/server';
import {requireUser} from '@/lib/session';
import {isSuperAdmin} from '@/lib/tenant';
import {getPool} from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const estados=new Set(['novo','em_atendimento','concluido','descartado']);
const response=(x:object,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});

/** Acesso EXCLUSIVO de superadmin. Não aceita empresa_id, nem seleciona todas as empresas. */
export async function GET(req:NextRequest){
 const user=await requireUser(req);
 if(!user||!isSuperAdmin(user))return response({error:'Acesso restrito ao superadmin AUROX'},403);
 try{
  const {searchParams}=new URL(req.url);
  const status=searchParams.get('status')||'todos';
  if(status!=='todos'&&!estados.has(status))return response({error:'Filtro inválido'},400);
  const db=await getPool().connect();
  try{
   const {rows}=await db.query(`SELECT s.id,s.nome_empresa,s.nome_responsavel,s.telefone,s.cidade,s.uf,
       s.modulos,s.mensalidade_centavos,s.primeiro_mes_centavos,s.observacao,
       s.status,s.anotacoes_internas,s.criado_em,s.atualizado_em,s.triagem_id
     FROM public.aurox_solicitacoes_comerciais s
     JOIN public.empresas e ON e.id=s.empresa_id AND e.slug='aurox-plataforma'
     WHERE ($1::text='todos' OR s.status=$1::text)
     ORDER BY CASE s.status WHEN 'novo' THEN 0 WHEN 'em_atendimento' THEN 1 ELSE 2 END,s.criado_em DESC
     LIMIT 200`,[status]);
   return response({solicitacoes:rows});
  }finally{db.release();}
 }catch(e:any){console.error('[aurox comercial GET]',{code:String(e?.code||'erro')});return response({error:'Não foi possível consultar as solicitações'},503)}
}

export async function PATCH(req:NextRequest){
 const user=await requireUser(req);
 if(!user||!isSuperAdmin(user))return response({error:'Acesso restrito ao superadmin AUROX'},403);
 const body=await req.json().catch(()=>null);
 const id=Number(body?.id);const status=String(body?.status||'');const notas=String(body?.anotacoes_internas??'');
 if(!Number.isSafeInteger(id)||id<=0||!estados.has(status)||notas.length>4000)
  return response({error:'Identificador, status ou observações inválidos'},400);
 try{
  const db=await getPool().connect();
  try{
   const {rows}=await db.query(`UPDATE public.aurox_solicitacoes_comerciais s
     SET status=$2::text,anotacoes_internas=$3,atualizado_por=$4,atualizado_em=now()
     FROM public.empresas e
     WHERE s.id=$1 AND e.id=s.empresa_id AND e.slug='aurox-plataforma'
     RETURNING s.id,s.status,s.atualizado_em`,[id,status,notas,user.id]);
   if(!rows.length)return response({error:'Solicitação interna não encontrada'},404);
   return response({ok:true,solicitacao:rows[0]});
  }finally{db.release();}
 }catch(e:any){console.error('[aurox comercial PATCH]',{code:String(e?.code||'erro')});return response({error:'Não foi possível atualizar o atendimento'},503)}
}
