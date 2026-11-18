/**
 * AUROX - tabela pública estática. Este arquivo NÃO consulta banco nem APIs.
 * Valores expressos em centavos BRL; propostas comerciais dependem de aprovação.
 * WhatsApp: SOMENTE uma sessão por empresa na oferta atual. Não há adicional de número.
 */
export const AUROX_BASE_CENTAVOS = 14900;
export const AUROX_LIMIAR_DESCONTO_CENTAVOS = 50000;
export const AUROX_DESCONTO_PROMO_PORCENTO = 25;
export const AUROX_DESCONTO_TETO_CENTAVOS = 18000;

export type AuroxModuloPublico = {
  id: string;
  nome: string;
  descricao: string;
  centavos: number;
  estado: 'disponivel' | 'implantacao' | 'previsto';
};
export const AUROX_MODULOS_PUBLICOS: readonly AuroxModuloPublico[] = [
  {id:'crm', nome:'CRM e funil de leads', descricao:'Triagem, atendimento, follow-up e tarefas', centavos:14900, estado:'disponivel'},
  {id:'financeiro', nome:'Financeiro', descricao:'Contas, parcelas e faturamento', centavos:17900, estado:'disponivel'},
  {id:'fiscal', nome:'Fiscal e Tributos', descricao:'Simulador gerencial, cobrado à parte', centavos:8900, estado:'implantacao'},
  {id:'anuncios', nome:'Integrações de anúncios', descricao:'Publicação e captação conforme homologação', centavos:8900, estado:'implantacao'},
  {id:'whatsapp', nome:'Aurox-WhatsApp', descricao:'Uma conexão por empresa; estabilidade em validação', centavos:19900, estado:'implantacao'},
  {id:'oficina', nome:'Oficina e documental', descricao:'Preparação de veículos e documentos', centavos:9900, estado:'disponivel'},
  {id:'inteligencia', nome:'Inteligência comercial', descricao:'Métricas, metas e rankings', centavos:7900, estado:'implantacao'},
  {id:'parceiros', nome:'Rede de parceiros', descricao:'Compartilhamentos com autorização', centavos:9900, estado:'implantacao'},
  {id:'site', nome:'Site personalizado', descricao:'Domínio próprio; registro cobrado à parte', centavos:11900, estado:'previsto'},
];
export type CotacaoAurox = {
  normalCentavos: number;
  primeiroMesCentavos: number;
  economiaCentavos: number;
  elegivelPromocao: boolean;
};
/** Fiscal e Tributos depende do Financeiro em toda selecao de servicos. */
export function normalizarModulosAurox(modulos: readonly string[]): string[] {
  const ids = new Set(modulos);
  if (ids.has('fiscal')) ids.add('financeiro');
  return [...ids];
}
/** Se Financeiro for desligado, o complemento Fiscal tambem deixa de ser contratado. */
export function alternarModuloAurox(modulos: readonly string[], id: string): string[] {
  const ids = new Set(modulos);
  if (ids.has(id)) {
    ids.delete(id);
    if (id==='financeiro') ids.delete('fiscal');
  } else {
    ids.add(id);
    if (id==='fiscal') ids.add('financeiro');
  }
  return [...ids];
}
export function cotarAurox(modulos: readonly string[]): CotacaoAurox {
  const ids = new Set(normalizarModulosAurox(modulos));
  const selecionados = AUROX_MODULOS_PUBLICOS.filter(m => ids.has(m.id));
  const normalCentavos = AUROX_BASE_CENTAVOS + selecionados.reduce((s,m)=>s+m.centavos,0);
  const elegivelPromocao = normalCentavos > AUROX_LIMIAR_DESCONTO_CENTAVOS;
  const economiaCentavos = elegivelPromocao ? Math.min(Math.round(normalCentavos*AUROX_DESCONTO_PROMO_PORCENTO/100),AUROX_DESCONTO_TETO_CENTAVOS) : 0;
  return {normalCentavos,primeiroMesCentavos:normalCentavos-economiaCentavos,economiaCentavos,elegivelPromocao};
}
export const reais = (centavos:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2}).format(centavos/100);
