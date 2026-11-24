import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { queryOne } from '@/lib/db';
import { processarEventoML } from '@/lib/mercadolivre/processar-notificacao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (value: object, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });

/** Endpoint de saúde: confirma presença da rota, sem expor credenciais ou empresas. */
export async function GET() {
  return json({ ok: true, service: 'aurox-mercadolivre-notificacoes', versao: '2026-11-24' });
}

/** O Mercado Livre manda POST com apenas user_id/topic/resource. Nunca confiar no payload para criar leads. */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 16_384) return json({ error: 'payload excedido' }, 413);
    let data: any;
    try { data = JSON.parse(raw); } catch { return json({ error: 'json inválido' }, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'payload inválido' }, 400);
    const configurado = String(process.env.ML_APP_ID || process.env.MERCADOLIVRE_APP_ID || '').trim();
    if (!configurado || String(data.application_id || '') !== configurado) return json({ error: 'aplicação inválida' }, 403);
    const usuario = String(data.user_id || '').trim();
    const topico = String(data.topic || '').trim();
    const recurso = String(data.resource || '').trim();
    if (!/^\d{1,20}$/.test(usuario) || !/^[a-z_]{2,60}$/.test(topico) || recurso.length > 250) {
      return json({ error: 'evento inválido' }, 400);
    }
    // Por enquanto só importamos VIS Leads; outros tópicos NÃO geram leads fictícios.
    if (topico !== 'vis_leads') return json({ ok: true, ignorado: true });
    if (!/^\/(?:vis\/leads\/[a-zA-Z0-9-]{1,80}|leads\/[a-zA-Z0-9-]{1,80}\/details)$/.test(recurso)) {
      return json({ ok: true, ignorado: true });
    }
    const empresa = await queryOne<{ empresa_id: number; total: number }>(
      `SELECT MIN(c.empresa_id)::integer AS empresa_id, count(DISTINCT c.empresa_id)::integer AS total
         FROM public.manu_conexoes_oauth c
         JOIN public.empresas e ON e.id=c.empresa_id
        WHERE c.provedor='mercadolivre' AND c.status='conectado' AND e.ativo=TRUE AND c.external_id=$1`,
      [usuario],
    );
    if (!empresa?.empresa_id || empresa.total !== 1) {
      console.warn('[ML webhook] vendedor sem vínculo exclusivo ativo', { usuario: usuario.slice(-4) });
      return json({ ok: true, ignorado: true });
    }
    const evento = await queryOne<{ id: number; situacao: string }>(
      `INSERT INTO public.aurox_ml_eventos(empresa_id, usuario_ml, topico, recurso)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(empresa_id,topico,recurso) DO UPDATE SET recebido_em=NOW()
       RETURNING id, situacao`,
      [empresa.empresa_id, usuario, topico, recurso],
    );
    if (evento && evento.situacao !== 'concluido' && evento.situacao !== 'ignorado') {
      // Confirma recebimento ao ML e processa depois, com evento salvo para recuperação.
      waitUntil(processarEventoML(Number(evento.id)).catch(() => {}));
    }
    return json({ ok: true });
  } catch (e) {
    console.error('[ML webhook] falha de persistência', e instanceof Error ? e.message : 'erro');
    return json({ error: 'recepção temporariamente indisponível' }, 503);
  }
}
