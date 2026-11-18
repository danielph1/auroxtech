/** Leitura com escopo fixado pela sessao validada; nao aceita empresa de query/body. */
import {query} from '@/lib/db';
import type {SessionUser} from '@/lib/session';
import {AUROX_MODULOS_PUBLICOS} from '@/lib/aurox-precos-publicos';

export async function modulosDisponiveis(u: Pick<SessionUser,'tipo'|'empresa_id'>): Promise<string[]> {
  if (String(u.tipo).toLowerCase()==='superadmin') return AUROX_MODULOS_PUBLICOS.map(m=>m.id);
  const empresaId = Number(u.empresa_id);
  if (!Number.isSafeInteger(empresaId) || empresaId<=0) return [];
  try {
    const {rows} = await query<{codigo:string}>(`
      SELECT s.codigo FROM public.aurox_contrato_servicos s
      JOIN public.aurox_contratos_comerciais c ON c.empresa_id=s.empresa_id
      WHERE s.empresa_id=$1 AND s.ativo=TRUE
        AND c.status IN ('rascunho','teste','ativo')`,[empresaId]);
    const ativos = new Set(rows.map(r=>r.codigo));
    // Contrato legado inconsistente nunca concede Fiscal sem Financeiro.
    if (!ativos.has('financeiro')) ativos.delete('fiscal');
    return [...ativos];
  } catch (e:any) {
    // Falha fechada: migracoes pendentes ou indisponibilidade nunca liberam extras.
    console.error('[aurox/modulos] indisponivel',String(e?.code||'consulta'));
    return [];
  }
}
