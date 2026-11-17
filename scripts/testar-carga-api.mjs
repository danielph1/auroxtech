/**
 * TESTE DE CARGA: somente ambiente de TESTE/preview. NÃO execute em clientes reais.
 * Uso: node scripts/testar-carga-api.mjs http://localhost:3000/login 100 20
 * 100 requisicoes, 20 simultaneas, timeout individual 5s. Mede p50/p95 reais.
 */
const target=String(process.argv[2]||'');
const total=Number(process.argv[3]||100),conc=Number(process.argv[4]||20);
if(!/^https?:\/\//.test(target)||!Number.isSafeInteger(total)||total<1||total>500||!Number.isSafeInteger(conc)||conc<1||conc>100)throw Error('Uso: node scripts/testar-carga-api.mjs URL NUM_REQUISICOES CONCORRENCIA');
const host=new URL(target).hostname;
if(!['localhost','127.0.0.1'].includes(host)&&!process.argv.includes('--confirmar-ambiente-de-testes'))throw Error('Por segurança, use staging + --confirmar-ambiente-de-testes; não pressione a produção sem autorização.');
let next=0,errors=0;const dur=[];const start=performance.now();
async function worker(){for(;;){const i=next++;if(i>=total)return;const t=performance.now();try{const res=await fetch(target,{signal:AbortSignal.timeout(5000),cache:'no-store'});await res.arrayBuffer();if(!res.ok)errors++;}catch{errors++;}dur.push(performance.now()-t);}}
await Promise.all(Array.from({length:Math.min(conc,total)},()=>worker()));
dur.sort((a,b)=>a-b);
const pct=n=>Math.round((dur[Math.max(0,Math.ceil(dur.length*n)-1)]||0)*10)/10;
console.log(JSON.stringify({total,concorrencia:conc,erros:errors,porcentagem_erros:Math.round(errors*10000/total)/100,p50_ms:pct(.5),p95_ms:pct(.95),p99_ms:pct(.99),duracao_total_s:Math.round((performance.now()-start)/100)/10,meta_p95_700ms_cumprida:pct(.95)<=700 && errors===0},null,2));
