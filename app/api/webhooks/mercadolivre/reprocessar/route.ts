import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { gestorIntegracoes, escopoEmpresa } from '@/lib/integracoes/auth';
import { query } from '@/lib/db';
import { processarEventoML } from '@/lib/mercadolivre/processar-notificacao';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recuperação manual autenticada. Não expõe dados pessoais nem aceita ID de outra empresa. */
export async function POST(req: NextRequest) {
  const gestor = await gestorIntegracoes(req);
  if (!gestor) return NextResponse.json({ error: 'sem permissão' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const empresaId = escopoEmpresa(gestor, body?.empresa_id ?? gestor.empresa_id);
  if (!empresaId) return NextResponse.json({ error: 'empresa obrigatória' }, { status: 400 });
  const { rows } = await query<{ id: number }>(
    `SELECT id FROM public.aurox_ml_eventos
      WHERE empresa_id=$1 AND (situacao IN ('pendente','erro') OR
          (situacao='processando' AND atualizado_em < NOW()-INTERVAL '2 minutes'))
      ORDER BY atualizado_em ASC LIMIT 10`, [empresaId],
  );
  for (const row of rows) waitUntil(processarEventoML(Number(row.id)).catch(() => {}));
  return NextResponse.json({ ok: true, reagendados: rows.length });
}
