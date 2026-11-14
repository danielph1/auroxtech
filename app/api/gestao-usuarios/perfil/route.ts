import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {verifyPassword} from '@/lib/password';
import {NIVEIS} from '@/lib/hierarquia-usuarios';
export const runtime='nodejs';export const dynamic='force-dynamic';
const admins=new Set(['superadmin','admin','gerente','marketing']);
const invalid=()=>NextResponse.json({error:'Conta fora de seu nível, loja ou empresa'},{status:403});
const positive=(x:unknown)=>{const n=Number(x);return Number.isSafeInteger(n)&&n>0?n:0};
export async function PATCH(req:NextRequest){
 const u=await requireUser(req);if(!u)return NextResponse.json({error:'Não autenticado'},{status:401});
 const b=await req.json().catch(()=>null);const id=positive(b?.id);
 if(!id)return NextResponse.json({error:'Selecione um usuário'},{status:400});
 const nome=String(b?.nome||'').trim(),login=String(b?.login||'').trim().toLowerCase();
 const email=String(b?.email??'').trim().toLowerCase(),telefone=String(b?.telefone??'').trim(),cpf=String(b?.cpf??'').replace(/\D/g,'');
 const senha=String(b?.senha_atual||'');
 if(nome.length<2||nome.length>140||!/^[a-z0-9._@-]{3,80}$/.test(login)||email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)||telefone.length>35||cpf&&cpf.length!==11||!senha)
  return NextResponse.json({error:'Confira nome, login, e-mail, telefone, CPF (11 dígitos) e senha atual'},{status:400});
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const r=await db.query(`SELECT id,tipo,empresa_id,loja,senha_hash FROM public.usuarios
    WHERE id=$1 AND COALESCE(ativo,FALSE) AND COALESCE(status,'ativo')='ativo' FOR SHARE`,[u.id]);
  const a=r.rows[0];if(!a||!admins.has(String(a.tipo).toLowerCase())||!verifyPassword(senha,a.senha_hash)){await db.query('ROLLBACK');return NextResponse.json({error:'Senha do gestor inválida ou sem permissão'},{status:403});}
  const t=await db.query(`SELECT id,tipo,empresa_id,loja,vendedor_id FROM public.usuarios WHERE id=$1 FOR UPDATE`,[id]);const target=t.rows[0];
  const ar=String(a.tipo).toLowerCase(),tr=String(target?.tipo||'').toLowerCase();
  if(!target||Number(target.id)===Number(a.id)||
    (ar!=='superadmin'&&(Number(a.empresa_id)!==Number(target.empresa_id)||(NIVEIS[ar]??99)>=(NIVEIS[tr]??0)))||
    (ar==='gerente'&&String(a.loja||'').toUpperCase()!==String(target.loja||'').toUpperCase())){
    await db.query('ROLLBACK');return invalid();
  }
  // Não há edição de cargo, empresa, loja ou permissões por esse endpoint.
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`manu-login:${login}`]);
  const other=await db.query('SELECT id FROM public.usuarios WHERE LOWER(TRIM(login))=$1 AND id<>$2 LIMIT 1',[login,id]);
  if(other.rowCount){await db.query('ROLLBACK');return NextResponse.json({error:'Esse login já está em uso'},{status:409});}
  const saved=await db.query(`UPDATE public.usuarios SET nome=$1,login=$2,email=$3,telefone=$4,cpf=$5
    WHERE id=$6 AND empresa_id=$7 RETURNING id,nome,login,email,telefone,cpf,tipo,loja,empresa_id`,
    [nome,login,email||null,telefone||null,cpf||null,id,target.empresa_id]);
  if(!saved.rowCount){await db.query('ROLLBACK');return invalid();}
  if(target.vendedor_id)await db.query('UPDATE public.vendedores SET nome=$1 WHERE id=$2 AND empresa_id=$3',[nome,target.vendedor_id,target.empresa_id]);
  if(target.empresa_id)await db.query(`INSERT INTO public.aurox_auditoria_alteracoes
    (empresa_id,usuario_id,tipo_usuario,recurso,recurso_id,acao,resumo,campos)
    VALUES($1,$2,$3,'usuarios',$4,'alterar','Dados de colaborador atualizados',ARRAY['nome','login','email','telefone','cpf'])`,
    [target.empresa_id,a.id,ar,id]);
  await db.query('COMMIT');return NextResponse.json({ok:true,usuario:saved.rows[0]},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e:any){await db.query('ROLLBACK').catch(()=>{});console.error('[usuario perfil]',e?.code||'erro');return NextResponse.json({error:e?.code==='23505'?'Login já está em uso':'Falha ao salvar perfil. Confira a migração de cadastro e auditoria.'},{status:e?.code==='23505'?409:503});}
 finally{db.release()}
}
