import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {queryOne} from '@/lib/db';
import {verificarMetaSignedRequest} from '@/lib/integracoes/meta-signed-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:NextRequest){
  const type=req.headers.get('content-type')||'';
  if(!type.includes('application/x-www-form-urlencoded'))return NextResponse.json({error:'formato_invalido'},{status:415});
  const body=await req.text();
  if(body.length>18000)return NextResponse.json({error:'solicitacao_grande'},{status:413});
  const verified=verificarMetaSignedRequest(new URLSearchParams(body).get('signed_request')||'');
  if(!verified)return NextResponse.json({error:'assinatura_invalida'},{status:400});
  try{
    const code=randomBytes(18).toString('hex');
    const result=await queryOne<{codigo:string}>(`INSERT INTO public.aurox_meta_eventos_privacidade
      (tipo,usuario_hash,emitido_em,codigo)
      VALUES('exclusao',$1,to_timestamp($2),$3)
      ON CONFLICT (tipo,usuario_hash,emitido_em) DO UPDATE
        SET atualizado_em=now()
      RETURNING codigo`,[verified.usuarioHash,verified.emitidoEm,code]);
    if(!result?.codigo)throw new Error('sem_codigo');
    const base=(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||'https://auroxtech.vercel.app').replace(/\/$/,'');
    return NextResponse.json({url:`${base}/api/integracoes/meta/exclusao/status?code=${encodeURIComponent(result.codigo)}`,confirmation_code:result.codigo},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('[meta/exclusao] persistencia',e instanceof Error?e.message:'erro');return NextResponse.json({error:'indisponivel'},{status:503});}
}
