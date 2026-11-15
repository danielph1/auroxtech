import {NextRequest,NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {verificarMetaSignedRequest} from '@/lib/integracoes/meta-signed-request';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function POST(req:NextRequest){
  const type=req.headers.get('content-type')||'';
  if(!type.includes('application/x-www-form-urlencoded'))return NextResponse.json({error:'formato_invalido'},{status:415});
  const body=await req.text();
  if(body.length>18000)return NextResponse.json({error:'solicitacao_grande'},{status:413});
  const signed=new URLSearchParams(body).get('signed_request')||'';
  const verified=verificarMetaSignedRequest(signed);
  if(!verified)return NextResponse.json({error:'assinatura_invalida'},{status:400});
  try{
    await query(`INSERT INTO public.aurox_meta_eventos_privacidade (tipo, usuario_hash, emitido_em)
      VALUES ('desautorizacao',$1,to_timestamp($2)) ON CONFLICT (tipo,usuario_hash,emitido_em) DO NOTHING`,
      [verified.usuarioHash,verified.emitidoEm]);
    // Não revoga conexões de uma empresa sem vínculo comprovado com o usuário Meta.
    // Integração só estará pronta para produção com mapeamento meta_user_id -> conexões.
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(e){console.error('[meta/desautorizar] persistencia',e instanceof Error?e.message:'erro');return NextResponse.json({error:'indisponivel'},{status:503});}
}
