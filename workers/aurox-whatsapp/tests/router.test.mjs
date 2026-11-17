import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const parent=path.resolve(folder,'../multi-router.mjs');
const stub=path.resolve(folder,'fake-child.mjs');
const SECRET='test-secret-isolated-'.padEnd(50,'Z');
async function port(){return await new Promise((resolve,reject)=>{const s=http.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{let p=s.address().port;s.close(()=>resolve(p))})});}
async function call(p,route,method='GET',data=null){
 const response=await fetch(`http://127.0.0.1:${p}${route}`,{method,headers:{Authorization:`Bearer ${SECRET}`,'Content-Type':'application/json'},
   ...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(12000)});
 return {status:response.status,body:await response.json()};
}
async function wait(p){const start=Date.now();while(Date.now()-start<6500){try{const r=await call(p,'/v1/worker/status');if(r.status===200)return;}catch{}await new Promise(r=>setTimeout(r,120))}throw Error('Router did not start');}
test('two companies have separate subprocesses, and logging B out preserves A',async()=>{
 const p=await port();const tmp=await mkdtemp(path.join(os.tmpdir(),'aurox-wa-test-'));
 const child=spawn(process.execPath,[parent],{env:{...process.env,NODE_ENV:'test',AUROX_WA_TEST_CHILD_SCRIPT:stub,
   AUROX_WA_WORKER_SECRET:SECRET,MANU_APP_URL:'https://invalid.example',PORT:String(p),MAX_SESSIONS:'10',DATA_DIR:tmp},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=String(b));child.stderr.on('data',b=>logs+=String(b));
 try{
  await wait(p);
  assert.equal((await call(p,'/v1/sessions/1/start','POST',{instance_id:'test'})).status,202);
  assert.equal((await call(p,'/v1/sessions/2/start','POST',{instance_id:'test'})).status,202);
  let diag=await call(p,'/v1/worker/status');assert.equal(diag.body.active_processes,2);
  assert.deepEqual(diag.body.sessions.map(s=>s.empresa_id).sort(),[1,2]);
  assert.equal((await call(p,'/v1/sessions/1/status')).body.status,'conectado');
  assert.equal((await call(p,'/v1/sessions/2/status')).body.status,'conectado');
  assert.equal((await call(p,'/v1/sessions/2/logout','POST',{})).status,200);
  const a=await call(p,'/v1/sessions/1/status');assert.equal(a.body.status,'conectado');
  diag=await call(p,'/v1/worker/status');assert.equal(diag.body.active_processes,1);
  assert.equal((await call(p,'/v1/sessions/2/start','POST',{instance_id:'test'})).status,202);
  diag=await call(p,'/v1/worker/status');assert.equal(diag.body.active_processes,2);
  assert.equal((await call(p,'/v1/sessions/1/status')).body.status,'conectado');
  // Fill all ten slots; verify an eleventh cannot displace an existing company.
  for(let id=3;id<=10;id++)assert.equal((await call(p,`/v1/sessions/${id}/start`,'POST',{instance_id:'test'})).status,202);
  diag=await call(p,'/v1/worker/status');assert.equal(diag.body.active_processes,10);
  const overflow=await call(p,'/v1/sessions/11/start','POST',{instance_id:'test'});
  assert.equal(overflow.status,429);
  assert.equal((await call(p,'/v1/sessions/1/status')).body.status,'conectado');
  assert.equal((await call(p,'/v1/sessions/10/status')).body.status,'conectado');
 }finally{
   child.kill('SIGTERM');await new Promise(resolve=>{if(child.exitCode!==null)return resolve();child.once('exit',resolve);setTimeout(()=>{child.kill('SIGKILL');resolve()},2500).unref()});
   await rm(tmp,{recursive:true,force:true});
 }
});
