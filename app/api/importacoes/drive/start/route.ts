import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {conferirAcessoDrive} from '@/lib/aurox-drive-access';
import {makeState,credentials,DRIVE_SCOPE} from '@/lib/aurox-drive';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const empresaId=Number(req.nextUrl.searchParams.get('empresa_id'));
 try{
  const u=await conferirAcessoDrive(req,empresaId);
  const {id,redirect}=credentials(),{nonce,state}=makeState(empresaId,u.id);
  const db=await getPool().connect();try{await db.query(`DELETE FROM public.aurox_drive_oauth_states WHERE expires_at<now()`);
   await db.query(`INSERT INTO public.aurox_drive_oauth_states(nonce,empresa_id,usuario_id,expires_at) VALUES($1,$2,$3,now()+interval '10 minutes')`,[nonce,empresaId,u.id]);
  }finally{db.release();}
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  for(const [k,v] of Object.entries({client_id:id,redirect_uri:redirect,response_type:'code',scope:DRIVE_SCOPE,access_type:'offline',prompt:'consent',state}))url.searchParams.set(k,v);
  return NextResponse.json({url:url.toString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Não foi possível iniciar Google Drive.'},{status:403});}
}
