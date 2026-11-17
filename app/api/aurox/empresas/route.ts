import {NextRequest,NextResponse} from 'next/server';
import {query,getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {hashPassword} from '@/lib/password';
import {isSuperAdmin} from '@/lib/tenant';
export const runtime='nodejs';
const response=(body:object,status:number)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const slugify=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
const numero=(s:unknown)=>String(s||'').replace(/\D/g,'');
const LOGIN_RE=/^[a-z0-9._@-]{3,80}$/;
const CODIGO_RE=/^[\p{L}\p{N}_-]{1,30}$/u;
const planosPermitidos=new Set(['vanguard','command','black']);

export async function GET(req:NextRequest){
 const u=await requireUser(req);if(!u||!isSuperAdmin(u))return response({error:'Apenas superadmin'},403);
 try{const {rows}=await query(`SELECT e.*, (SELECT count(*)::int FROM public.lojas l WHERE l.empresa_id=e.id) AS qtd_lojas,
   (SELECT count(*)::int FROM public.usuarios u WHERE u.empresa_id=e.id AND COALESCE(u.ativo,TRUE)) AS qtd_usuarios
   FROM public.empresas e ORDER BY e.id`);return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});}
 catch(e:any){console.error('[empresas GET]',String(e?.code||'erro'));return response({error:'Falha ao consultar empresas'},500);}
}

/** Transação atômica e segregação multiempresa; nunca misturar registros de outra concessionária. */
export async function POST(req:NextRequest){
 const u=await requireUser(req);if(!u||!isSuperAdmin(u))return response({error:'Apenas superadmin'},403);
 const b=await req.json().catch(()=>null);if(!b||typeof b!=='object')return response({error:'JSON inválido'},400);
 const nome=String(b.nome||'').trim().slice(0,140);
 const telefone=numero(b.telefone);
 const adm=b.admin||{};
 const login=String(adm.login||'').trim().toLowerCase();const senha=String(adm.senha||'');
 const adminNome=String(adm.nome||'Administrador').trim().slice(0,140);
 const plano=String(b.plano||'black').trim().toLowerCase();
 const explicit=String(b.slug||'').trim();
 const baseSlug=slugify(explicit||nome);
 const lojas=(Array.isArray(b.lojas)?b.lojas:[]).map((l:any)=>({
   codigo:String(l.codigo||'').trim().toUpperCase(),nome:String(l.nome||l.codigo||'').trim().slice(0,140),
   plano:String(l.plano||plano).toLowerCase()
 })).filter(l=>l.codigo);
 if(nome.length<2||!baseSlug)return response({error:'Informe o nome da empresa e um identificador válido.'},400);
 if(telefone.length<10||telefone.length>15)return response({error:'Telefone obrigatório: informe DDD e número (10 a 15 dígitos).'},400);
 if(!LOGIN_RE.test(login))return response({error:'Login do administrador: use 3 a 80 caracteres, apenas letras, números, ponto, hífen, @ ou _.'},400);
 if(senha.length<8||senha.length>150)return response({error:'A senha inicial deve conter pelo menos 8 caracteres.'},400);
 if(!planosPermitidos.has(plano)||!lojas.length||lojas.some(l=>!CODIGO_RE.test(l.codigo)||!planosPermitidos.has(l.plano)))
  return response({error:'Escolha um plano válido e informe códigos de loja válidos.'},400);
 if(new Set(lojas.map(l=>l.codigo)).size!==lojas.length)return response({error:'Códigos de loja repetidos dentro desta empresa.'},400);
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  // Impede duas solicitações concorrentes usando o mesmo login.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-login:${login}`]);
  const user=await client.query('SELECT id FROM public.usuarios WHERE LOWER(TRIM(login))=$1 LIMIT 1',[login]);
  if(user.rowCount){await client.query('ROLLBACK');return response({error:'O login informado já está reservado no AUROX. Escolha outro login.'},409);}
  // Um nome de concessionária repetido não deve ser confundido com login repetido.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-slug:${baseSlug}`]);
  let slug=baseSlug;
  if(explicit){
   const d=await client.query('SELECT 1 FROM public.empresas WHERE slug=$1',[slug]);
   if(d.rowCount){await client.query('ROLLBACK');return response({error:'Este identificador já está cadastrado. Escolha outro.'},409);}
  }else{
   let attempt=2;
   while((await client.query('SELECT 1 FROM public.empresas WHERE slug=$1',[slug])).rowCount){
    const suffix=`-${attempt++}`;slug=baseSlug.slice(0,60-suffix.length)+suffix;
    if(attempt>1000)throw Error('Quantidade de identificadores excedida');
   }
  }
  const {rows:[empresa]}=await client.query(`INSERT INTO public.empresas(nome,slug,telefone,ativo,plano,contrato_inicio)
    VALUES($1,$2,$3,TRUE,$4,CURRENT_DATE) RETURNING *`,[nome,slug,telefone,plano]);
  const lojasCriadas=[];
  for(const l of lojas){const {rows:[loja]}=await client.query(`INSERT INTO public.lojas(empresa_id,codigo,nome,ativo,plano)
    VALUES($1,$2,$3,TRUE,$4) RETURNING *`,[empresa.id,l.codigo,l.nome,l.plano]);lojasCriadas.push(loja);}
  const {rows:[admin]}=await client.query(`INSERT INTO public.usuarios(nome,login,senha_hash,tipo,loja,empresa_id,ativo,status)
    VALUES($1,$2,$3,'admin',$4,$5,TRUE,'ativo') RETURNING id,nome,login,tipo,loja,empresa_id,ativo`,
    [adminNome,login,hashPassword(senha),lojas[0].codigo,empresa.id]);
  await client.query('COMMIT');return response({empresa,lojas:lojasCriadas,admin},201);
 }catch(e:any){await client.query('ROLLBACK').catch(()=>{});
  const code=String(e?.code||''),constraint=String(e?.constraint||'').slice(0,100),table=String(e?.table||'').slice(0,80);
  console.error('[aurox/empresas POST]',{code,constraint,table});
  if(code==='42703'&&/telefone/.test(String(e?.message||'')))return response({error:'Atualização do banco pendente: execute a migração comercial de telefone.'},503);
  if(code==='23514')return response({error:constraint==='usuarios_loja_check'||/loja/.test(constraint)?'Uma restrição antiga de código de loja está impedindo o cadastro. Consulte o diagnóstico SQL da migração.':`O banco rejeitou uma regra de cadastro (${constraint||'CHECK'}). Consulte os logs do servidor.`},422);
  if(code==='23505'){
   if(/lojas.*codigo|codigo.*loja/i.test(constraint))return response({error:'O banco ainda parece exigir código de loja globalmente único. A loja 001 deve poder existir em outras empresas; revise a constraint.'},409);
   if(/empresas.*nome|nome.*empresas/i.test(constraint))return response({error:'O banco aponta uma empresa com este nome, possivelmente inativa. Confira os registros e a regra de unicidade antes de tentar novamente.'},409);
   if(/slug|empresas/i.test(constraint))return response({error:'Identificador da concessionária já reservado. Tente um identificador diferente.'},409);
   if(/login|usuarios/i.test(constraint))return response({error:'Login já reservado no sistema. Escolha outro.'},409);
   return response({error:`Conflito de unicidade no banco (${constraint||'restrição não identificada'}). Verifique a migration de lojas.`},409);
  }
  return response({error:'Não foi possível criar a empresa. Verifique os logs e as migrations; nada foi gravado.'},500);
 }finally{client.release();}
}
