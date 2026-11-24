import { query, queryOne } from '@/lib/db';
import { accessTokenMLValido } from './access-token';

type Evento = {
  id: number; empresa_id: number; usuario_ml: string; topico: string; recurso: string;
};

function limpar(v: unknown, limite: number): string {
  return String(v ?? '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim().slice(0, limite);
}

async function mlGet(path: string, token: string): Promise<any> {
  // Nunca permitir origem/host indicado pelo webhook; caminhos fechados por regex.
  if (!/^\/(?:vis\/leads\/[a-zA-Z0-9-]{1,80}|leads\/[a-zA-Z0-9-]{1,80}\/details|items\/[A-Z]{3}[0-9]{5,20})$/.test(path)) {
    throw new Error('Recurso Mercado Livre não permitido.');
  }
  const r = await fetch(`https://api.mercadolibre.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store', signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`Mercado Livre retornou HTTP ${r.status} para recurso permitido`);
  return r.json();
}

/** Recebe evento já persistido. Uma única execução faz a transição pendente→processando. */
export async function processarEventoML(id: number): Promise<'feito' | 'em_andamento'> {
  const evento = await queryOne<Evento>(
    `UPDATE public.aurox_ml_eventos
       SET situacao='processando', tentativas=tentativas+1, atualizado_em=NOW(), ultimo_erro=NULL
     WHERE id=$1 AND (situacao IN ('pendente','erro')
       OR (situacao='processando' AND atualizado_em < NOW() - INTERVAL '2 minutes'))
     RETURNING id, empresa_id, usuario_ml, topico, recurso`, [id],
  );
  if (!evento) return 'em_andamento';
  try {
    const token = await accessTokenMLValido(Number(evento.empresa_id));
    // O provedor é verificado pelo token OAuth daquela empresa, não pelo JSON público.
    let detalhes: any;
    try {
      detalhes = await mlGet(evento.recurso, token);
    } catch (firstError) {
      // Para contact_request/reservation o endpoint oficial é /leads/{id}/details.
      if (!evento.recurso.startsWith('/vis/leads/')) throw firstError;
      const leadIdFromPath = evento.recurso.split('/').pop() || '';
      detalhes = await mlGet(`/leads/${leadIdFromPath}/details`, token);
    }
    const leadId = limpar(detalhes?.id, 80);
    if (!leadId) throw new Error('API Mercado Livre não retornou ID do lead.');
    const itemId = limpar(detalhes?.item_id, 30);
    if (!/^[A-Z]{3}\d{5,20}$/.test(itemId)) throw new Error('Lead sem anúncio verificável.');
    const item = await mlGet(`/items/${itemId}`, token);
    if (String(item?.seller_id) !== evento.usuario_ml) throw new Error('Lead de anúncio não pertencente à empresa conectada.');

    const nome = limpar(detalhes?.name, 200) || 'Interessado Mercado Livre';
    const telefone = limpar(detalhes?.phone, 50) || null;
    const email = limpar(detalhes?.email, 254) || null;
    const tipo = limpar(detalhes?.contact_type, 60);
    const observacao = `Novo contato pelo anúncio ${itemId} (${tipo || 'contato'}). ID Mercado Livre: ${leadId}`.slice(0, 1800);
    // Única sentença SQL atômica: o lead é criado e o evento recebe o ID juntos.
    await query(
      `WITH inserido AS (
         INSERT INTO public.triagem (empresa_id, nome, telefone, email, interesse, origem, mensagem, status)
         SELECT empresa_id, $2, $3, $4, $5, 'mercadolivre', $6, 'aguardando'
           FROM public.aurox_ml_eventos WHERE id=$1 AND situacao='processando'
         RETURNING id
       )
       UPDATE public.aurox_ml_eventos
          SET situacao='concluido', triagem_id=(SELECT id FROM inserido), atualizado_em=NOW()
        WHERE id=$1 AND EXISTS (SELECT 1 FROM inserido)`,
      [id, nome, telefone, email, itemId, observacao],
    );
    return 'feito';
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha no processamento';
    console.error('[ML webhook] evento não processado', { id, codigo: msg.slice(0, 120) });
    await query(
      `UPDATE public.aurox_ml_eventos SET situacao='erro', ultimo_erro=$2, atualizado_em=NOW()
        WHERE id=$1 AND situacao='processando'`,
      [id, msg.slice(0, 250)],
    ).catch(() => {});
    throw e;
  }
}
