/** AUROX Comercial V3 — Node >=22 com --experimental-strip-types */
import test from 'node:test';
import assert from 'node:assert/strict';
import {cotarAurox,AUROX_MODULOS_PUBLICOS,AUROX_DESCONTO_PROMO_PORCENTO,AUROX_DESCONTO_TETO_CENTAVOS} from '../lib/aurox-precos-publicos.ts';
test('promoção: 25% apenas no primeiro mês; teto de R$180',()=>{
 assert.equal(AUROX_DESCONTO_PROMO_PORCENTO,25);assert.equal(AUROX_DESCONTO_TETO_CENTAVOS,18000);
});
test('base R$149 sem desconto',()=>{
 const c=cotarAurox([]);assert.deepEqual([c.normalCentavos,c.primeiroMesCentavos,c.economiaCentavos],[14900,14900,0]);
});
test('pacote R$596 desconta R$149 na primeira mensalidade',()=>{
 const c=cotarAurox(['crm','financeiro','site']);assert.deepEqual([c.normalCentavos,c.economiaCentavos,c.primeiroMesCentavos],[59600,14900,44700]);
});
test('desconto limitado a R$180',()=>{
 const c=cotarAurox(AUROX_MODULOS_PUBLICOS.map(x=>x.id));assert.equal(c.economiaCentavos,18000);
});
test('sem cobrança de números adicionais de WhatsApp',()=>{
 const c=cotarAurox(['whatsapp']);assert.equal(c.normalCentavos,34800);
});
test('só acima de R$500',()=>{
 const c=cotarAurox(['crm','oficina','inteligencia']);assert.equal(c.normalCentavos,47600);assert.equal(c.economiaCentavos,0);
});
