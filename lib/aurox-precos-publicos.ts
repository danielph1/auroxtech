/**
 * Catálogo PÚBLICO do AUROX: valores fixos no bundle, sem acesso ao banco/API.
 * Cotação comercial ilustrativa: contrato só será criado pelo módulo futuro de assinatura.
 * Valores em centavos de BRL para evitar arredondamento de ponto flutuante.
 */
export const AUROX_BASE_CENTAVOS = 14900;
export const AUROX_LIMIAR_DESCONTO_CENTAVOS = 50000;
export const AUROX_DESCONTO_PROMO_PORCENTO = 25;
export const AUROX_DESCONTO_TETO_CENTAVOS = 18000;
export const AUROX_WHATSAPP_NUMERO_EXTRA_CENTAVOS = 6900;
export const AUROX_NUMEROS_MAX_SIMULADOR = 30;

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
  {id:'anuncios', nome:'Integrações de anúncios', descricao:'Conectores conforme homologação dos parceiros', centavos:8900, estado:'implantacao'},
  {id:'whatsapp', nome:'Aurox-WhatsApp', descricao:'Sessão Web por empresa; capacidade em expansão', centavos:19900, estado:'implantacao'},
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
  extrasWhatsAppCentavos: number;
};
export function cotarAurox(modulos: readonly string[], numerosWhatsApp = 1): CotacaoAurox {
  const ids = new Set(modulos);
  const selecionados = AUROX_MODULOS_PUBLICOS.filter(m => ids.has(m.id));
  const quantidade = Number.isFinite(numerosWhatsApp) ? Math.min(AUROX_NUMEROS_MAX_SIMULADOR,Math.max(1,Math.trunc(numerosWhatsApp))) : 1;
  const extrasWhatsAppCentavos = ids.has('whatsapp') ? (quantidade-1)*AUROX_WHATSAPP_NUMERO_EXTRA_CENTAVOS : 0;
  const normalCentavos = AUROX_BASE_CENTAVOS + selecionados.reduce((s,m)=>s+m.centavos,0) + extrasWhatsAppCentavos;
  const elegivelPromocao = normalCentavos > AUROX_LIMIAR_DESCONTO_CENTAVOS;
  const descontoBruto = Math.round(normalCentavos * AUROX_DESCONTO_PROMO_PORCENTO / 100);
  const economiaCentavos = elegivelPromocao ? Math.min(descontoBruto, AUROX_DESCONTO_TETO_CENTAVOS) : 0;
  const primeiroMesCentavos = normalCentavos - economiaCentavos;
  return {normalCentavos,primeiroMesCentavos,economiaCentavos,elegivelPromocao,extrasWhatsAppCentavos};
}
export const reais = (centavos:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2}).format(centavos/100);
