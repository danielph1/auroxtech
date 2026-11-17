import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Os testes de isolamento sao leves por padrao: apenas dois subprocessos Node.
// Para teste de capacidade REAL do PC com 30 processos falsos:
// $env:AUROX_WA_STRESS_TEST='1'; npm run test:sessoes; Remove-Item Env:AUROX_WA_STRESS_TEST
// Nenhum teste conecta WhatsApp real, toca no banco ou usa .env / .wa-data.
const folder=path.dirname(fileURLToPath(import.meta.url));
const parent=path.resolve(folder,'../multi-router.mjs');
const stub=path.resolve(folder,'fake-child.mjs');
const SECRET='test-secret-isolated-'.padEnd(50,'Z');
const STRESS=process.env.AUROX_WA_STRESS_TEST==='1';
const MAX=STRESS?30:2;

async function freePort(){
  return await new Promise((resolve,reject)=>{
    const s=http.createServer();
    s.once('error',reject);
    s.listen(0,'127.0.0.1',()=>{
      const p=s.address().port;
      s.close(err=>err?reject(err):resolve(p));
    });
  });
}
async function call(port,route,method='GET',data=null){
  const response=await fetch(`http://127.0.0.1:${port}${route}`,{
    method,
    headers:{Authorization:`Bearer ${SECRET}`,'Content-Type':'application/json'},
    ...(data!==null?{body:JSON.stringify(data)}:{}),
    signal:AbortSignal.timeout(18000),
  });
  return {status:response.status,body:await response.json()};
}
async function wait(port,child,getLogs){
  const start=Date.now();
  while(Date.now()-start<8000){
    if(child.exitCode!==null)throw Error(`Roteador encerrou: ${child.exitCode}\n${getLogs()}`);
    try{const r=await call(port,'/v1/worker/status');if(r.status===200)return;}
    catch{}
    await new Promise(r=>setTimeout(r,130));
  }
  throw Error(`Roteador nao iniciou em 8 s. Logs:\n${getLogs()}`);
}

// Verifica estado da API e inclui corpo da resposta e logs na mensagem de erro.
async function expectStatus(port,route,method,data,expected,label,getLogs){
  const r=await call(port,route,method,data);
  assert.equal(r.status,expected,
    `${label}: esperado HTTP ${expected}, obtido ${r.status}. Resposta: ${JSON.stringify(r.body)}\nUltimos logs:\n${getLogs().slice(-5000)}`);
  return r.body;
}

test(`isolamento A/B, recuperacao e limite ${MAX} (${STRESS?'STRESS opcional':'rotina rapida'})`,
  {timeout:STRESS?180000:45000},async()=>{
  const port=await freePort();
  const tmp=await mkdtemp(path.join(os.tmpdir(),'aurox-wa-isolamento-'));
  const child=spawn(process.execPath,[parent],{
    env:{...process.env,NODE_ENV:'test',AUROX_WA_TEST_CHILD_SCRIPT:stub,
      AUROX_WA_WORKER_SECRET:SECRET,MANU_APP_URL:'https://invalid.example',
      PORT:String(port),MAX_SESSIONS:String(MAX),DATA_DIR:tmp},
    stdio:['ignore','pipe','pipe'],windowsHide:true,
  });
  let logs='';
  const getLogs=()=>logs;
  child.stdout?.on('data',b=>{logs+=String(b);});
  child.stderr?.on('data',b=>{logs+=String(b);});
  try{
    await wait(port,child,getLogs);
    for(const id of [1,2]){
      await expectStatus(port,`/v1/sessions/${id}/start`,'POST',{instance_id:'test'},202,
        `Iniciar empresa ${id}`,getLogs);
    }
    let diag=await call(port,'/v1/worker/status');
    assert.equal(diag.body.active_processes,2,'A e B devem ter processos separados');
    assert.deepEqual(diag.body.sessions.map(s=>s.empresa_id).sort((a,b)=>a-b),[1,2]);
    for(const id of [1,2]){
      const st=await call(port,`/v1/sessions/${id}/status`);
      assert.equal(st.body.status,'conectado',`Empresa ${id} nao ficou conectada`);
    }
    await expectStatus(port,'/v1/sessions/2/logout','POST',{},200,
      'Desconectar exclusivamente B',getLogs);
    assert.equal((await call(port,'/v1/sessions/1/status')).body.status,'conectado',
      'Desconectar B nao pode afetar A');
    diag=await call(port,'/v1/worker/status');
    assert.equal(diag.body.active_processes,1);
    await expectStatus(port,'/v1/sessions/2/start','POST',{instance_id:'test'},202,
      'Reconectar B',getLogs);
    assert.equal((await call(port,'/v1/sessions/1/status')).body.status,'conectado',
      'Reconectar B nao pode afetar A');

    // Sob AUROX_WA_STRESS_TEST=1, mede o PC com 30 processos Node leves;
    // NÃO simula consumo de 30 navegadores Chromium reais.
    for(let id=3;id<=MAX;id++){
      await expectStatus(port,`/v1/sessions/${id}/start`,'POST',{instance_id:'test'},202,
        `STRESS: iniciar empresa ${id}/${MAX}`,getLogs);
      if(id%5===0)console.log(`[AUROX TESTE] ${id}/${MAX} subprocessos leves iniciados`);
    }
    diag=await call(port,'/v1/worker/status');
    assert.equal(diag.body.active_processes,MAX);
    await expectStatus(port,`/v1/sessions/${MAX+1}/start`,'POST',{instance_id:'test'},429,
      'Bloquear a sessao excedente sem derrubar as anteriores',getLogs);
    assert.equal((await call(port,'/v1/sessions/1/status')).body.status,'conectado');
    assert.equal((await call(port,`/v1/sessions/${MAX}/status`)).body.status,'conectado');
  }finally{
    child.kill('SIGTERM');
    await Promise.race([
      new Promise(resolve=>{if(child.exitCode!==null||child.signalCode!==null)return resolve();child.once('exit',resolve);}),
      new Promise(resolve=>setTimeout(()=>{child.kill('SIGKILL');resolve();},5000)),
    ]);
    await rm(tmp,{recursive:true,force:true,maxRetries:4,retryDelay:250});
  }
});
