import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {parseState,exchangeCode,encryptToken} from '@/lib/aurox-drive';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const base=String(process.env.NEXT_PUBLIC_APP_URL||new URL(req.url).origin).replace(/\/$/,'');
 const redirect=(status:string)=>NextResponse.redirect(`${base}/importacoes/planilhas?drive=${encodeURIComponent(status)}`,303);
 if(req.nextUrl.searchParams.has('error'))return redirect('cancelado');
 const state=req.nextUrl.searchParams.get('state')||'',code=req.nextUrl.searchParams.get('code')||'';
 try{
  if(!code||code.length>3000)throw new Error('Código inválido.');
  const payload=parseState(state),db=await getPool().connect();
  try{
   const {rows}=await db.query(`DELETE FROM public.aurox_drive_oauth_states
     WHERE nonce=$1 AND empresa_id=$2 AND usuario_id=$3 AND expires_at>now() RETURNING empresa_id`,[payload.n,payload.e,payload.u]);
   if(rows.length!==1)throw new Error('Autorização repetida ou expirada.');
   const check=await db.query(`SELECT 1 FROM public.usuarios u JOIN public.empresas e ON e.id=$2
     WHERE u.id=$1 AND COALESCE(u.ativo,FALSE)
       AND LOWER(u.tipo) IN ('superadmin','admin','marketing','gerente')
       AND (LOWER(u.tipo)='superadmin' OR u.empresa_id=e.id)
       AND COALESCE(e.ativo,TRUE)`,[payload.u,payload.e]);
   if(!check.rowCount)throw new Error('Usuário sem permissão atual.');
  }finally{db.release();}
  const refresh=await exchangeCode(code),encrypted=encryptToken(refresh);
  const db2=await getPool().connect();try{await db2.query(`INSERT INTO public.aurox_drive_conexoes(empresa_id,refresh_token_enc,conectado_por)
     VALUES($1,$2,$3) ON CONFLICT (empresa_id) DO UPDATE SET refresh_token_enc=EXCLUDED.refresh_token_enc,
       conectado_por=EXCLUDED.conectado_por,atualizado_em=now()`,[payload.e,encrypted,payload.u]);}
   finally{db2.release();}
  return redirect('ok');
 }catch(e){console.error('[drive oauth]',e instanceof Error?e.message:'erro');return redirect('erro');}
}
