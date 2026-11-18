/** AUROX Fiscal: simulação gerencial. Não apura DAS, NF-e, ICMS, IBS/CBS ou créditos fiscais. */
export type RegimeFiscal = 'simples_nacional' | 'lucro_presumido' | 'lucro_real' | 'nao_informado';
export type BaseFiscal = 'receita_bruta' | 'diferenca_venda_compra' | 'manual';
export interface DadosFiscais {
  regime: RegimeFiscal;
  base: BaseFiscal;
  valor_venda_centavos: number;
  custo_aquisicao_centavos: number;
  despesas_centavos: number;
  base_manual_centavos?: number;
  aliquota_percentual: number;
}
export interface ResultadoFiscal {
  base_calculo_centavos: number;
  tributo_estimado_centavos: number;
  margem_antes_tributo_centavos: number;
  margem_apos_tributo_centavos: number;
  aliquota_percentual: number;
  nota: string;
}
const seguro = (n: unknown) => Number.isSafeInteger(n) && Number(n)>=0 && Number(n)<=100_000_000_000;
export function calcularFiscal(d: DadosFiscais): ResultadoFiscal {
  if (!['simples_nacional','lucro_presumido','lucro_real','nao_informado'].includes(d.regime)) throw Error('Regime fiscal inválido');
  if (!['receita_bruta','diferenca_venda_compra','manual'].includes(d.base)) throw Error('Base inválida');
  if(!seguro(d.valor_venda_centavos)||d.valor_venda_centavos<=0||!seguro(d.custo_aquisicao_centavos)||!seguro(d.despesas_centavos)) throw Error('Informe valores em centavos válidos');
  if(!Number.isFinite(d.aliquota_percentual)||d.aliquota_percentual<0||d.aliquota_percentual>100) throw Error('Alíquota fora do intervalo de 0 a 100%');
  const base=d.base==='receita_bruta'?d.valor_venda_centavos:d.base==='diferenca_venda_compra'
    ?Math.max(0,d.valor_venda_centavos-d.custo_aquisicao_centavos):d.base_manual_centavos;
  if(!seguro(base)) throw Error('Base manual inválida');
  const tributo=Math.round(Number(base)*d.aliquota_percentual/100);
  const margem=d.valor_venda_centavos-d.custo_aquisicao_centavos-d.despesas_centavos;
  return {base_calculo_centavos:Number(base),tributo_estimado_centavos:tributo,
    margem_antes_tributo_centavos:margem,margem_apos_tributo_centavos:margem-tributo,
    aliquota_percentual:d.aliquota_percentual,
    nota:'Estimativa matemática com base e alíquota fornecidas pelo usuário. Não é apuração fiscal, DAS ou guia para recolhimento.'};
}
/** Entrada do formulário em reais: aceita 1250,50 ou 1250.50, rejeita formato ambíguo. */
export function emCentavos(raw: unknown): number {
 const s=String(raw??'').trim().replace(/\s/g,'');
 if(!/^(?:\d{1,12}(?:[.,]\d{1,2})?)$/.test(s)) throw Error('Valor deve ter no máximo duas casas decimais, sem separador de milhar');
 const [whole,decimal='']=s.replace(',','.').split('.');
 const val=Number(whole)*100+Number(decimal.padEnd(2,'0'));
 if(!seguro(val))throw Error('Valor fora dos limites');
 return val;
}
