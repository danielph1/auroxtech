/** node --experimental-strip-types scripts/testar-fila-aurox.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {FilaConcorrencia,SobrecargaTemporaria} from '../lib/infra/controle-concorrencia.ts';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('20 requisições ativas e 5 aguardando são liberadas sem exceder o limite local',async()=>{
 const gate=new FilaConcorrencia(20,10,700);let active=0,peak=0;
 const tasks=Array.from({length:25},(_,i)=>gate.executar(async()=>{active++;peak=Math.max(peak,active);await sleep(55);active--;return i;}));
 assert.equal(gate.situacao.ativos,20);assert.equal(gate.situacao.aguardando,5);
 const result=await Promise.all(tasks);assert.equal(result.length,25);assert.equal(peak,20);assert.equal(gate.situacao.aguardando,0);
});
test('fila excedida rejeita rapidamente e não consome recursos ilimitados',async()=>{
 const gate=new FilaConcorrencia(1,1,700);
 const a=gate.executar(async()=>{await sleep(70);return 'A';});
 const b=gate.executar(async()=>{await sleep(5);return 'B';});
 await assert.rejects(gate.executar(async()=>true),SobrecargaTemporaria);
 assert.deepEqual(await Promise.all([a,b]),['A','B']);
});
test('700ms de fila significa limite de espera, não promessa de resposta total',async()=>{
 const gate=new FilaConcorrencia(1,1,50);
 const a=gate.executar(async()=>{await sleep(110);return true;});
 await assert.rejects(gate.executar(async()=>true),SobrecargaTemporaria);
 assert.equal(await a,true);
});
