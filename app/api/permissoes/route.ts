import {NextRequest,NextResponse} from 'next/server';
import {getPool,query,queryOne} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {RECURSOS,ACOES,ACOES_RECURSO,podeAlterarPapel,permitidoPeloCargo,permissoesBloqueadas} from '@/lib/permissoes-granulares';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(data:object,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const idValido=(v:unknown)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>0?n:0;};

export async function GET(req:NextRequest){
 const actor=await requireUser(req);if(!actor)return json({error:'Não autorizado'},401);
 if(req.nextUrl.searchParams.get('minhas')==='1' || !['admin','superadmin'].includes(actor.tipo)){
  return json({bloqueadas:await permissoesBloqueadas(actor)});
 }
 const empresaId=actor.tipo==='superadmin'?idValido(req.nextUrl.searchParams.get('empresa_id')):idValido(actor.empresa_id);
 if(!empresaId)return json({error:'Selecione uma empresa'},400);
 try{
  const pessoas=await query<{id:number;nome:string;tipo:string}>(`SELECT id,nome,LOWER(tipo) tipo FROM public.usuarios
    WHERE empresa_id=$1 AND COALESCE(ativo,TRUE) AND LOWER(tipo)<>'superadmin' ORDER BY nome LIMIT 300`,[empresaId]);
  const [cargos,usuarios]=await Promise.all([
   query(`SELECT cargo,recurso,acao,permitido FROM public.aurox_permissoes_cargo WHERE empresa_id=$1`,[empresaId]),
   query(`SELECT usuario_id,recurso,acao,permitido FROM public.aurox_permissoes_usuario WHERE empresa_id=$1`,[empresaId]),
  ]);
  return json({empresa_id:empresaId,recursos:RECURSOS,acoes:ACOES,acoes_por_recurso:ACOES_RECURSO,
   usuarios:pessoas.rows.filter(p=>podeAlterarPapel(actor.tipo,p.tipo)),
   cargos:[...new Set(pessoas.rows.map(p=>p.tipo).filter(p=>podeAlterarPapel(actor.tipo,p)))],
   regras_cargo:cargos.rows.filter((r:any)=>podeAlterarPapel(actor.tipo,r.cargo)),
   regras_usuario:usuarios.rows.filter((r:any)=>pessoas.rows.some(p=>p.id===r.usuario_id&&podeAlterarPapel(actor.tipo,p.tipo)))});
 }catch(e:any){return json({error:e?.code==='42P01'?'Execute a migration de Permissões no Supabase':'Não foi possível carregar permissões'},503);}
}
export async function PUT(req:NextRequest){
 const actor=await requireUser(req);if(!actor||!['admin','superadmin'].includes(actor.tipo))return json({error:'Somente administrador'},403);
 const b=await req.json().catch(()=>null);
 if(!b || !['cargo','usuario'].includes(b.escopo) || typeof b.permitido!=='boolean' && b.permitido!==null ||
    !RECURSOS.some(x=>x[0]===b.recurso)||!ACOES.includes(b.acao)||!ACOES_RECURSO[b.recurso as keyof typeof ACOES_RECURSO]?.includes(b.acao))return json({error:'Parâmetros inválidos'},400);
 const empresaId=actor.tipo==='superadmin'?idValido(b.empresa_id):idValido(actor.empresa_id);
 if(!empresaId || (actor.tipo!=='superadmin'&&empresaId!==Number(actor.empresa_id)))return json({error:'Empresa fora do escopo'},403);
 const client=await getPool().connect();
 try{
  await client.query('BEGIN');
  const owner=await client.query('SELECT id FROM public.empresas WHERE id=$1 AND ativo=TRUE',[empresaId]);
  if(!owner.rowCount){await client.query('ROLLBACK');return json({error:'Empresa inválida'},404);}
  let alvo:string|number;
  let papel:string;
  if(b.escopo==='usuario'){
   const id=idValido(b.usuario_id);
   const user=await client.query('SELECT id,LOWER(tipo) AS tipo FROM public.usuarios WHERE id=$1 AND empresa_id=$2 AND COALESCE(ativo,TRUE) FOR SHARE',[id,empresaId]);
   if(!user.rowCount){await client.query('ROLLBACK');return json({error:'Usuário fora da empresa'},403);}
   alvo=id;papel=user.rows[0].tipo;
  }else{
   alvo=String(b.cargo||'').trim().toLowerCase();papel=alvo;
  }
  if(!podeAlterarPapel(actor.tipo,papel)||!permitidoPeloCargo(papel,b.recurso)){
   await client.query('ROLLBACK');return json({error:'Não é possível elevar permissões acima da hierarquia existente'},403);
  }
  if(b.escopo==='usuario'){
   if(b.permitido===null){await client.query(`DELETE FROM public.aurox_permissoes_usuario WHERE empresa_id=$1 AND usuario_id=$2 AND recurso=$3 AND acao=$4`,[empresaId,alvo,b.recurso,b.acao]);}
   else await client.query(`INSERT INTO public.aurox_permissoes_usuario(empresa_id,usuario_id,recurso,acao,permitido,alterado_por)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(empresa_id,usuario_id,recurso,acao) DO UPDATE
    SET permitido=EXCLUDED.permitido,alterado_por=EXCLUDED.alterado_por,alterado_em=now()`,[empresaId,alvo,b.recurso,b.acao,b.permitido,actor.id]);
  }else{
   if(b.permitido===null){await client.query(`DELETE FROM public.aurox_permissoes_cargo WHERE empresa_id=$1 AND cargo=$2 AND recurso=$3 AND acao=$4`,[empresaId,alvo,b.recurso,b.acao]);}
   else await client.query(`INSERT INTO public.aurox_permissoes_cargo(empresa_id,cargo,recurso,acao,permitido,alterado_por)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(empresa_id,cargo,recurso,acao) DO UPDATE
    SET permitido=EXCLUDED.permitido,alterado_por=EXCLUDED.alterado_por,alterado_em=now()`,[empresaId,alvo,b.recurso,b.acao,b.permitido,actor.id]);
  }
  await client.query('COMMIT');return json({ok:true});
 }catch(e:any){await client.query('ROLLBACK').catch(()=>{});
  console.error('[permissoes PUT]',String(e?.code||'erro'));
  return json({error:'Não foi possível salvar a permissão'},503);
 }finally{client.release();}
}
