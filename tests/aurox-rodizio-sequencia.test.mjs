import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {proximoVendedorId} from '../lib/aurox-rodizio-sequencia.ts';

test('rodízio A B C A, sem embaralhamento',()=>{
  let last=null; const list=[6,11,35], outputs=[];
  for(let i=0;i<7;i++){last=proximoVendedorId(list,last);outputs.push(last);}
  assert.deepEqual(outputs,[6,11,35,6,11,35,6]);
});
test('atribuição manual não mexe no último automático',()=>{
  const ultimoAutomatico=11; const vendedorManual=35;
  assert.equal(proximoVendedorId([6,11,35],ultimoAutomatico),vendedorManual);
  assert.equal(proximoVendedorId([6,11,35],ultimoAutomatico),35);
});
test('mudança na equipe não perde a sequência',()=>{
  assert.equal(proximoVendedorId([6,35],11),6);
  assert.equal(proximoVendedorId([6,11,35],35),6);
  assert.equal(proximoVendedorId([],null),null);
});
