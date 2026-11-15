import {NextRequest,NextResponse} from 'next/server';
import {queryOne} from '@/lib/db';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const code=req.nextUrl.searchParams.get('code')||'';
 if(!/^[a-f0-9]{36}$/.test(code))return NextResponse.json({error:'codigo_invalido'},{status:400});
 const row=await queryOne<{status:string}>(`SELECT status FROM public.aurox_meta_eventos_privacidade WHERE tipo='exclusao' AND codigo=$1`,[code]);
 if(!row)return NextResponse.json({error:'nao_encontrado'},{status:404});
 return NextResponse.json({status:row.status,descricao:row.status==='pendente'?'Solicitação recebida, aguardando análise e tratamento.':'Consulte o suporte para detalhes.'},{headers:{'Cache-Control':'no-store'}});
}
