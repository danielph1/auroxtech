import { query, queryOne } from '@/lib/db';
import { decryptMLToken, encryptMLToken } from './ml-token-crypto';

async function tokenML(empresaId: number) {
  return queryOne<{
    id: string;
    access_token_enc: string;
    refresh_token_enc: string | null;
    external_id: string;
  }>(
    `SELECT id, access_token_enc, refresh_token_enc, external_id FROM public.manu_conexoes_oauth
      WHERE empresa_id=$1 AND provedor='mercadolivre' AND status='conectado'
      ORDER BY atualizado_em DESC NULLS LAST, criado_em DESC LIMIT 1`,
    [empresaId],
  );
}

/** Só devolve um token da própria concessionária, sempre cifrado em repouso. */
export async function accessTokenMLValido(empresaId: number): Promise<string> {
  const row = await tokenML(empresaId);
  if (!row?.access_token_enc) throw new Error('Mercado Livre não conectado — Integrações → Conectar Mercado Livre');
  const accessToken = decryptMLToken(row.access_token_enc);
  const response = await fetch('https://api.mercadolibre.com/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store', signal: AbortSignal.timeout(7000),
  });
  if (response.ok) {
    const me = await response.json();
    if (String(me?.id) !== row.external_id) throw new Error('Conta Mercado Livre incompatível com a empresa vinculada.');
    return accessToken;
  }
  const clientId = process.env.ML_APP_ID || process.env.MERCADOLIVRE_APP_ID || '';
  const secret = process.env.ML_APP_SECRET || process.env.MERCADOLIVRE_APP_SECRET || '';
  if (!row.refresh_token_enc || !clientId || !secret) {
    throw new Error('Token Mercado Livre expirado. Reconecte o canal em Integrações.');
  }
  const refreshToken = decryptMLToken(row.refresh_token_enc);
  const refreshed = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId, client_secret: secret, refresh_token: refreshToken }),
    cache: 'no-store', signal: AbortSignal.timeout(7000),
  });
  const j = await refreshed.json().catch(() => ({}));
  if (!refreshed.ok || !j?.access_token) throw new Error('Não foi possível renovar o token Mercado Livre; reconecte o canal.');
  const nextAccess = encryptMLToken(String(j.access_token));
  const nextRefresh = j.refresh_token ? encryptMLToken(String(j.refresh_token)) : row.refresh_token_enc;
  await query(
    `UPDATE public.manu_conexoes_oauth SET access_token_enc=$2, refresh_token_enc=$3, atualizado_em=NOW() WHERE id=$1 AND empresa_id=$4`,
    [row.id, nextAccess, nextRefresh, empresaId],
  );
  return String(j.access_token);
}
