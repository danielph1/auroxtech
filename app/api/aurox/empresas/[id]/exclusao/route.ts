import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {isSuperAdmin} from '@/lib/tenant';
import {verifyPassword} from '@/lib/password';
import {createHash} from 'node:crypto';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const json=(x:object,status=200)=>NextResponse.json(x,{status,headers:{'Cache-Control':'no-store'}});
async function auth(req:NextRequest){const u=await requireUser(req);return u&&isSuperAdmin(u)?u:null}
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await auth(req);if(!actor)return json({error:'Apenas superadmin'},403);
 const id=Number((await params).id);if(!Number.isSafeInteger(id)||id<=0)return json({error:'ID inválido'},400);
 const db=await getPool().connect();try{
  const {rows:[empresa]}=await db.query(`SELECT id,nome,slug,ativo FROM public.empresas WHERE id=$1`,[id]);
  if(!empresa)return json({error:'Não encontrada'},404);
  if(empresa.slug==='aurox-plataforma')return json({error:'Empresa interna protegida'},403);
  const {rows:tables}=await db.query(`SELECT c.relname AS tabela FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attname='empresa_id' AND NOT a.attisdropped
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname<>'empresas' ORDER BY c.relname`);
  const contagens:Record<string,number>={};
  for(const row of tables){const name=String(row.tabela);if(!/^[a-zA-Z0-9_]+$/.test(name))continue;
   const {rows:[count]}=await db.query(`SELECT COUNT(*)::int AS n FROM public."${name}" WHERE empresa_id=$1`,[id]);
   if(Number(count.n)>0)contagens[name]=Number(count.n);
  }
  return json({empresa,contagens,apaga_dados_relacionais:true,arquivos_storage_exigem_verificacao:true,aviso:'Exclusão irreversível: confira backup e arquivos antes de prosseguir. Dependências desconhecidas impedem a transação.'});
 }catch(e:any){console.error('[preflight exclusao]',String(e?.code||'erro'));return json({error:'Não foi possível inspecionar dependências'},503)}finally{db.release()}
}
export async function DELETE(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const actor=await auth(req);if(!actor)return json({error:'Apenas superadmin'},403);
 const id=Number((await params).id),body=await req.json().catch(()=>null);
 const slug=String(body?.slug||'').trim(),senha=String(body?.senha||''),confirmar=String(body?.confirmar||'');
 if(!Number.isSafeInteger(id)||id<=0||senha.length<1||senha.length>200||confirmar!=='EXCLUIR')return json({error:'Confirmação incompleta'},400);
 const db=await getPool().connect();try{
  await db.query('BEGIN');
  const {rows:[admin]}=await db.query(`SELECT senha_hash FROM public.usuarios WHERE id=$1 AND tipo='superadmin' AND ativo=true FOR SHARE`,[actor.id]);
  if(!admin||!verifyPassword(senha,admin.senha_hash)){await db.query('ROLLBACK');return json({error:'Senha incorreta'},403)}
  const {rows:[e]}=await db.query(`SELECT id,slug,ativo FROM public.empresas WHERE id=$1 FOR UPDATE`,[id]);
  if(!e){await db.query('ROLLBACK');return json({error:'Empresa não encontrada'},404)}
  if(e.slug==='aurox-plataforma'||e.slug!==slug||e.ativo){await db.query('ROLLBACK');return json({error:'Empresa protegida, identificador divergente ou ainda ativa'},409)}
  const superUsers=await db.query(`SELECT 1 FROM public.usuarios WHERE empresa_id=$1 AND LOWER(tipo)='superadmin' LIMIT 1`,[id]);
  if(superUsers.rowCount){await db.query('ROLLBACK');return json({error:'Empresa com superadmin vinculado: revise manualmente antes de excluir'},409)}
  const {rows:[r]}=await db.query(`SELECT public.aurox_excluir_empresa_relacional($1)::jsonb AS relatorio`,[id]);
  await db.query(`INSERT INTO public.aurox_exclusoes_auditoria(empresa_original_id,ator_id,empresa_slug_hash,tabelas) VALUES($1,$2,$3,$4::jsonb)`,
    [id,actor.id,createHash('sha256').update(slug).digest('hex'),JSON.stringify(r.relatorio||{})]);
  await db.query('COMMIT');return json({ok:true,relatorio:r.relatorio,observacao:'Registros relacionais excluídos. Verifique também mídias externas e Storage antes de considerar remoção completa.'});
 }catch(e:any){await db.query('ROLLBACK').catch(()=>{});console.error('[excluir empresa]',{code:String(e?.code||'erro'),constraint:String(e?.constraint||'').slice(0,100)});
  return json({error:'Exclusão NÃO realizada. Existem dependências ou migrations pendentes. Nenhum dado foi removido; revise o backup e o relatório de dependências.'},409);
 }finally{db.release()}
}
