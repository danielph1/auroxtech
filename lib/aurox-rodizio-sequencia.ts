/** Ordem estável dos vendedores que efetivamente participam do rodízio de uma empresa. */
export function proximoVendedorId(vendedores: number[], ultimoId: number | null): number | null {
  if (!vendedores.length) return null;
  const anterior = ultimoId == null ? -1 : vendedores.indexOf(ultimoId);
  return vendedores[(anterior + 1) % vendedores.length];
}
