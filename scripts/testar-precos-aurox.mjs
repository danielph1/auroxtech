/** Executar: node --experimental-strip-types scripts/testar-precos-aurox.mjs (Node >=22). */
import test from 'node:test';
import assert from 'node:assert/strict';
import {cotarAurox} from '../lib/aurox-precos-publicos.ts';

test('base custa R$149 e não dispara promoção',()=>{
 const p=cotarAurox([]);assert.equal(p.normalCentavos,14900);assert.equal(p.primeiroMesCentavos,14900);assert.equal(p.elegivelPromocao,false);
});
test('somente R$500 exatos não gera desconto',()=>{
 // Serviço estático: soma 149 + 149 + 99 + 79 = 476, não ultrapassa 500.
 const p=cotarAurox(['crm','oficina','inteligencia']);assert.equal(p.normalCentavos,47600);assert.equal(p.elegivelPromocao,false);
});
test('R$596 concede 50% apenas na primeira mensalidade',()=>{
 const p=cotarAurox(['crm','financeiro','site']);assert.equal(p.normalCentavos,59600);assert.equal(p.primeiroMesCentavos,29800);assert.equal(p.economiaCentavos,29800);assert.equal(p.elegivelPromocao,true);
});
test('30 números de WhatsApp calculam 29 adicionais e mantêm limite',()=>{
 const p=cotarAurox(['whatsapp'],30);assert.equal(p.normalCentavos,14900+19900+29*6900);
 assert.equal(cotarAurox(['whatsapp'],300).normalCentavos,p.normalCentavos);
 assert.equal(cotarAurox(['whatsapp','whatsapp'],2).normalCentavos,14900+19900+6900);
});
test('número adicional não é cobrado sem módulo WhatsApp',()=>{
 assert.equal(cotarAurox(['crm'],30).normalCentavos,29800);
});
