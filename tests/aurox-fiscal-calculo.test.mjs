import test from 'node:test';
import assert from 'node:assert/strict';
import {calcularFiscal,emCentavos} from '../lib/fiscal/calculo.ts';
const d={regime:'simples_nacional',base:'receita_bruta',valor_venda_centavos:6000000,custo_aquisicao_centavos:4700000,despesas_centavos:150000,aliquota_percentual:6};
test('soma centavos BR com segurança',()=>{
 assert.equal(emCentavos('55000,50'),5500050);
 assert.equal(emCentavos('1.5'),150);
 assert.throws(()=>emCentavos('1.000,00'));
});
test('simula somente a alíquota fornecida pelo usuário',()=>{
 const r=calcularFiscal(d);
 assert.equal(r.base_calculo_centavos,6000000);
 assert.equal(r.tributo_estimado_centavos,360000);
 assert.equal(r.margem_antes_tributo_centavos,1150000);
 assert.equal(r.margem_apos_tributo_centavos,790000);
});
test('permite base manual, mas não a presume',()=>{
 const r=calcularFiscal({...d,base:'manual',base_manual_centavos:800000,aliquota_percentual:10});
 assert.equal(r.tributo_estimado_centavos,80000);
 assert.throws(()=>calcularFiscal({...d,base:'manual'}));
});
test('rejeita valor inválido e alíquota acima de 100',()=>{
 assert.throws(()=>calcularFiscal({...d,aliquota_percentual:200}));
 assert.throws(()=>calcularFiscal({...d,valor_venda_centavos:-1}));
 assert.throws(()=>calcularFiscal({...d,regime:'regime_falso'}));
});
