import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { decryptMetaToken } from '@/lib/integracoes/meta-token-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const u = await requireUser(req);
  if (!u) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || '').trim();
  const recipientId = String(body.recipient_id || body.psid || '').trim();
  if (!text || !recipientId) {
    return NextResponse.json({ error: 'text e recipient_id obrigatórios' }, { status: 400 });
  }

  // Sem empresa padrão e sem consultar conexões de outras concessionárias.
  const perfil = await queryOne<{ empresa_id: number|null; tipo: string; ativo: boolean }>(
    'SELECT empresa_id, LOWER(TRIM(tipo)) AS tipo, ativo FROM public.usuarios WHERE id=$1', [u.id]);
  if (!perfil?.ativo) return NextResponse.json({ error: 'conta inativa' }, { status: 403 });
  const solicitada = Number(body.empresa_id || perfil.empresa_id || 0);
  if (!Number.isSafeInteger(solicitada) || solicitada <= 0 ||
      (perfil.tipo !== 'superadmin' && solicitada !== Number(perfil.empresa_id))) {
    return NextResponse.json({ error: 'empresa inválida' }, { status: 403 });
  }
  const empresaId = solicitada;
  const conn = await queryOne<{ access_token_enc: string }>(
    `SELECT access_token_enc FROM public.manu_conexoes_oauth
      WHERE status='conectado' AND provedor IN ('meta_facebook','meta_instagram')
        AND empresa_id = $1
      ORDER BY atualizado_em DESC NULLS LAST LIMIT 1`,
    [empresaId],
  );
  if (!conn?.access_token_enc) {
    return NextResponse.json({ error: 'Facebook/Instagram não conectado' }, { status: 400 });
  }

  let pageToken: string;
  try { pageToken = decryptMetaToken(conn.access_token_enc); }
  catch { return NextResponse.json({ error: 'Reconecte a Meta para atualizar o token protegido.' }, { status: 409 }); }

  const res = await fetch(
    'https://graph.facebook.com/v21.0/me/messages?access_token=' + encodeURIComponent(pageToken),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    },
  );
  const json = await res.json();
  if (!res.ok) {
    return NextResponse.json({ error: json?.error?.message || 'falha Meta', detail: json }, { status: 400 });
  }
  return NextResponse.json({ ok: true, meta: json });
}
