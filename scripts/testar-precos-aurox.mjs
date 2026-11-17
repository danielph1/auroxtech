/** Node >=22: node --experimental-strip-types scripts/testar-precos-aurox.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {cotarAurox,AUROX_DESCONTO_PROMO_PORCENTO,AUROX_DESCONTO_TETO_CENTAVOS} from '../lib/aurox-precos-publicos.ts';
test('regra de desconto: 25% e teto R$180',()=>{
 assert.equal(AUROX_DESCONTO_PROMO_PORCENTO,25);
 assert.equal(AUROX_DESCONTO_TETO_CENTAVOS,18000);
});
test('base sem desconto',()=>{
 const v=cotarAurox([]);assert.deepEqual([v.normalCentavos,v.primeiroMesCentavos,v.economiaCentavos],[14900,14900,0]);
});
test('pacote de R$596: desconta R$149 somente no primeiro mês',()=>{
 const v=cotarAurox(['crm','financeiro','site']);
 assert.deepEqual([v.normalCentavos,v.economiaCentavos,v.primeiroMesCentavos],[59600,14900,44700]);
});
test('pacote grande limita desconto a R$180',()=>{
 const v=cotarAurox(['whatsapp'],30);
 assert.equal(v.economiaCentavos,18000);assert.equal(v.primeiroMesCentavos,v.normalCentavos-18000);
});
test('sem Whatsapp não há cobrança de número adicional',()=>{
 assert.equal(cotarAurox(['crm'],30).normalCentavos,29800);
});
test('desconto só acima de R$500',()=>{
 // Aproximação via catálogo: R$ 149+149+99+79 = R$476
 const v=cotarAurox(['crm','oficina','inteligencia']);assert.equal(v.normalCentavos,47600);assert.equal(v.economiaCentavos,0);
});
