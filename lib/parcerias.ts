import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { requireUser, type SessionUser } from '@/lib/session';

/** O codigo de convite NAO e um token de acesso a leads/estoque. */
export function novoCodigoConvite() {
  return `ARX_${randomBytes(32).toString('base64url')}`;
}
export function hashConvite(codigo: string) {
  return createHash('sha256').update(codigo, 'utf8').digest('hex');
}
export function numeroPositivo(value: unknown): number {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}
export function papelParcerias(u: SessionUser | null): boolean {
  return !!u && ['admin', 'superadmin'].includes(String(u.tipo || '').toLowerCase());
}
export type ContextoParceria = {
  ok: true;
  actor: SessionUser;
  empresaId: number;
  empresaNome: string;
} | { ok: false; response: NextResponse };

function erro(mensagem: string, status: number): ContextoParceria {
  return { ok: false, response: NextResponse.json({ error: mensagem }, { status }) };
}

/** Sempre fixa UM tenant; nunca transforma superadmin em query global de dados compartilhados. */
export async function contextoParceria(req: NextRequest, rawEmpresa: unknown): Promise<ContextoParceria> {
  const actor = await requireUser(req);
  if (!actor) return erro('Não autenticado', 401);
  if (!papelParcerias(actor)) return erro('Apenas admin e superadmin podem gerenciar parcerias', 403);

  const indicado = numeroPositivo(rawEmpresa);
  const isSuper = String(actor.tipo).toLowerCase() === 'superadmin';
  const proprio = numeroPositivo(actor.empresa_id);
  if (!isSuper && indicado && indicado !== proprio) return erro('Empresa fora do seu escopo', 403);
  const empresaId = isSuper ? indicado : proprio;
  if (!empresaId) return erro(isSuper ? 'Selecione uma empresa para atuar' : 'Sua conta não possui empresa', 400);

  const empresa = await queryOne<{ id: number; nome: string }>(
    'SELECT id,nome FROM public.empresas WHERE id=$1 AND COALESCE(ativo,TRUE)=TRUE',
    [empresaId],
  );
  if (!empresa) return erro('Empresa inativa ou inexistente', 404);
  return { ok: true, actor, empresaId, empresaNome: empresa.nome };
}

export function noStore() { return { 'Cache-Control': 'private, no-store' }; }

/** Regex impede que um ID de negocio/URL seja usado como codigo. */
export function conviteValido(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  return /^ARX_[a-zA-Z0-9_-]{43}$/.test(raw) ? raw : null;
}
