import { NextRequest, NextResponse } from 'next/server';
import { authorizedWorker } from '@/lib/aurox-whatsapp/security';
import { processarRodizioTriagem } from '@/lib/aurox-rodizio-triagem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Endpoint interno autenticado pelo segredo do worker, nunca público. */
export async function GET(req:NextRequest) {
  if (!authorizedWorker(req.headers.get('authorization')))
    return NextResponse.json({error:'Não autorizado'},{status:401});
  try {
    return NextResponse.json(await processarRodizioTriagem(null,15),
      {headers:{'Cache-Control':'private, no-store'}});
  } catch (e) {
    console.error('[triagem rodízio] falha de processamento',
      e instanceof Error?e.message:'erro');
    return NextResponse.json({error:'Rodízio temporariamente indisponível'},{status:503});
  }
}
