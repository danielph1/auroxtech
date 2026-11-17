/**
 * AUROX WhatsApp: 1 process per company, up to MAX_SESSIONS simultaneously.
 * The router is the ONLY public worker HTTP server. Child servers listen on
 * localhost and can access only their own empresa_id.
 * Do not run this alongside the legacy `node index.mjs` worker.
 */
import http from 'node:http';
import { fork } from 'node:child_process';
import { createHash, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startPushDispatcher } from './push-dispatcher.mjs';

const BASE = String(process.env.MANU_APP_URL || '').replace(/\/$/, '');
const SECRET = String(process.env.AUROX_WA_WORKER_SECRET || '');
const PORT = Number(process.env.PORT || 3456);
const MAX = Math.max(1, Math.min(100, Number(process.env.MAX_SESSIONS || 10)));
const ROOT = path.resolve(process.env.DATA_DIR || './.wa-data');
const WAIT_MS = 8000;
const CHILD_SCRIPT = process.env.NODE_ENV === 'test' && process.env.AUROX_WA_TEST_CHILD_SCRIPT
  ? path.resolve(process.env.AUROX_WA_TEST_CHILD_SCRIPT)
  : fileURLToPath(new URL('./index.mjs', import.meta.url));
const nodes = new Map(); // empresa_id -> {process, port, ready, intentional}
const authorized = new Set(); // ids enabled by POST /start or authenticated bootstrap
const failures = new Map(); // only crashed session retries
let stopping = false;
let bootstrapBusy = false;
if (SECRET.length < 32 || !/^https:\/\//.test(BASE) || !Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('MANU_APP_URL HTTPS, AUROX_WA_WORKER_SECRET (32+) e PORT válido obrigatórios');
  process.exit(1);
}
function equalBearer(value) {
  const token = String(value || '').replace(/^Bearer\s+/i, '');
  return Buffer.byteLength(token) === Buffer.byteLength(SECRET)
    && timingSafeEqual(Buffer.from(token), Buffer.from(SECRET));
}
function companyId(raw) {
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 && n < 1e9 ? n : 0;
}
function reply(res, status, obj) {
  if (res.headersSent || res.destroyed) return;
  const body = JSON.stringify(obj);
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body)});
  res.end(body);
}
async function freePort() {
  return await new Promise((resolve,reject) => {
    const srv = http.createServer();
    srv.once('error',reject);
    srv.listen(0,'127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(err => err ? reject(err) : resolve(port));
    });
  });
}
async function readyCheck(node,id) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (node.exited) throw Error(`Sessão ${id}: processo encerrou durante a inicialização`);
    try {
      const response=await fetch(`http://127.0.0.1:${node.port}/v1/sessions/${id}/status`,{
        headers:{Authorization:`Bearer ${SECRET}`}, signal:AbortSignal.timeout(800)});
      if (response.ok) return node;
    }catch{}
    await new Promise(r => setTimeout(r,180));
  }
  throw Error(`Sessão ${id}: processo não abriu a porta em ${WAIT_MS/1000}s`);
}
function tail(source,id,tag) {
  source?.on('data',buf => {
    const msg=String(buf).trim();
    if (msg) (tag==='stderr'?console.error:console.log)(`[empresa ${id}][${tag}] ${msg.slice(0,3500)}`);
  });
}
function stopNode(id, node) {
  if(!node) return;
  node.intentional=true;
  if (nodes.get(id)===node) nodes.delete(id);
  if (node.process && !node.exited) node.process.kill('SIGTERM');
}
async function spawnCompany(id) {
  if (!companyId(id)) throw Error('Empresa inválida');
  const current=nodes.get(id);
  if (current) return await current.ready;
  if (nodes.size >= MAX) throw Object.assign(Error(`Limite de ${MAX} empresas simultâneas alcançado`),{httpCode:429});
  // Reserve slot BEFORE awaiting anything; concurrent requests cannot exceed MAX.
  const node={port:null,process:null,exited:false,intentional:false,ready:null};
  nodes.set(id,node);
  node.ready=(async()=>{
    node.port=await freePort();
    if(node.intentional)throw Error('Sessão cancelada');
    const env={...process.env,AUROX_WA_CHILD:'1',AUROX_WA_ONLY_EMPRESA_ID:String(id),PORT:String(node.port)};
    node.process=fork(CHILD_SCRIPT,[],{
      env,execArgv:[],stdio:['ignore','pipe','pipe','ipc'],windowsHide:true,
    });
    tail(node.process.stdout,id,'stdout');
    tail(node.process.stderr,id,'stderr');
    node.process.once('error',err=>console.error(`[empresa ${id}] falha no subprocesso: ${err.message}`));
    node.process.once('exit',(code,signal)=>{
      node.exited=true;
      if (nodes.get(id)===node) nodes.delete(id);
      console.warn(`[empresa ${id}] processo encerrado: code=${code ?? '-'} signal=${signal ?? '-'}`);
      if (stopping || node.intentional || !authorized.has(id)) return;
      const prev=failures.get(id)||{count:0,since:Date.now()};
      if(Date.now()-prev.since>10*60*1000){prev.count=0;prev.since=Date.now();}
      prev.count++;
      failures.set(id,prev);
      if (prev.count>5) {console.error(`[empresa ${id}] parou após 5 reinícios em 10 min; outras empresas continuam`);return;}
      const delay=Math.min(30000,1500*2**(prev.count-1));
      console.warn(`[empresa ${id}] tentativa isolada de recuperação em ${delay}ms`);
      setTimeout(()=>{
        if(!stopping && authorized.has(id) && !nodes.has(id))
          void spawnCompany(id).catch(e=>console.error(`[empresa ${id}] reinício: ${e.message}`));
      },delay).unref();
    });
    await readyCheck(node,id);
    console.info(`[AUROX] empresa ${id}: processo privado iniciado (total ${nodes.size}/${MAX})`);
    return node;
  })();
  try{return await node.ready;}catch(e){stopNode(id,node);throw e;}
}
async function proxy(req,res,node,id,action) {
  await new Promise(resolve=>{
    const p=http.request({hostname:'127.0.0.1',port:node.port,path:`/v1/sessions/${id}/${action}`,
      method:req.method,headers:{Authorization:`Bearer ${SECRET}`,
        'Content-Type':'application/json',
        ...(req.headers['content-length']?{'Content-Length':req.headers['content-length']}:{})}},upstream=>{
      const h={'content-type':upstream.headers['content-type']||'application/json','cache-control':'no-store'};
      res.writeHead(upstream.statusCode||502,h);
      upstream.pipe(res);upstream.on('end',resolve);
    });
    p.setTimeout(action==='send'?75000:20000,()=>p.destroy(Error('Tempo limite da sessão')));
    p.once('error',e=>{console.error(`[empresa ${id}] proxy ${action}: ${e.message}`);reply(res,502,{error:`Sessão da empresa ${id} indisponível`});resolve();});
    if(req.method==='POST')req.pipe(p);else p.end();
  });
}
function unpackEvent(buf) {
  const key=createHash('sha256').update(`aurox-wa-outbox:v1:${SECRET}`).digest();
  const iv=buf.subarray(0,12),tag=buf.subarray(12,28),payload=buf.subarray(28);
  const d=createDecipheriv('aes-256-gcm',key,iv);d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(payload),d.final()]).toString('utf8'));
}
/** Keep old pending encrypted events, segregating them before children start. */
async function migrateLegacyOutbox() {
  const spool=path.join(ROOT,'outbox');
  await fs.mkdir(spool,{recursive:true,mode:0o700});
  let moved=0,ignored=0;
  for(const name of await fs.readdir(spool)) {
    if(!/^[a-f0-9]{64}\.bin$/.test(name))continue;
    const from=path.join(spool,name);
    try{
      const ev=unpackEvent(await fs.readFile(from));
      const id=companyId(ev.empresa_id);
      if(!id)throw Error('empresa_id inválido');
      const target=path.join(spool,String(id));
      await fs.mkdir(target,{recursive:true,mode:0o700});
      const to=path.join(target,name);
      try {
        await fs.copyFile(from,to,fs.constants.COPYFILE_EXCL);
      } catch(e) {
        if(e.code!=='EEXIST')throw e;
        const existing=await fs.readFile(to);
        const original=await fs.readFile(from);
        if(!existing.equals(original))throw Error('Destino divergente, evento original preservado');
      }
      await fs.unlink(from);moved++;
    }catch(e){ignored++;console.warn(`[AUROX] evento legado ${name.slice(0,8)} não migrado: ${e.message}`);}
  }
  if(moved||ignored)console.info(`[AUROX] fila anterior: ${moved} migrados; ${ignored} pendentes de revisão`);
}
async function bootstrap() {
  if(stopping || bootstrapBusy)return;
  bootstrapBusy=true;
  try{
    const r=await fetch(`${BASE}/api/internal/aurox-whatsapp/bootstrap`,{
      headers:{Authorization:`Bearer ${SECRET}`}, signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw Error(`HTTP ${r.status}`);
    const data=await r.json();
    const ids=[...new Set((Array.isArray(data.sessions)?data.sessions:[]).map(s=>companyId(s.empresa_id)).filter(Boolean))];
    for(const id of ids.slice(0,MAX)){
      authorized.add(id);
      if(!nodes.has(id)){
        try{await spawnCompany(id);}catch(e){console.error(`[empresa ${id}] restaurar: ${e.message}`);}
        await new Promise(r=>setTimeout(r,850));
      }
    }
    if(ids.length>MAX)console.warn(`[AUROX] ${ids.length} empresas ativadas, limite configurado ${MAX}`);
  }catch(e){console.warn('[AUROX] bootstrap das sessões indisponível:',e.message);}
  finally{bootstrapBusy=false;}
}

await migrateLegacyOutbox();
const server=http.createServer(async(req,res)=>{
  if(!equalBearer(req.headers.authorization)){reply(res,401,{error:'Não autorizado'});return;}
  const url=new URL(req.url||'/','http://localhost');
  if((url.pathname==='/v1/worker/status' || url.pathname==='/v1/health') && req.method==='GET'){
    const sessions=await Promise.all([...nodes.entries()].map(async([id,node])=>{
      let status='iniciando';
      try{const r=await fetch(`http://127.0.0.1:${node.port}/v1/sessions/${id}/status`,{
        headers:{Authorization:`Bearer ${SECRET}`},signal:AbortSignal.timeout(1300)});
        if(r.ok)status=String((await r.json()).status||'desconhecido');
      }catch{status=node.exited?'encerrado':'iniciando';}
      return {empresa_id:id,status,pid:node.process?.pid||null};
    }));
    reply(res,200,{ok:true,mode:'isolated-processes',max_sessions:MAX,active_processes:nodes.size,
      active_sessions:nodes.size,memory_rss_mb:Math.round(process.memoryUsage().rss/1048576),
      uptime_seconds:Math.round(process.uptime()),
      sessions:sessions.map(s=>({...s,last_error:null}))});return;
  }
  const m=url.pathname.match(/^\/v1\/sessions\/(\d+)\/(status|start|logout|send)$/);
  if(!m){reply(res,404,{error:'Rota inexistente'});return;}
  const id=companyId(m[1]),action=m[2];
  if(!id){reply(res,400,{error:'Empresa inválida'});return;}
  if((action==='status' && req.method!=='GET')||(action!=='status' && req.method!=='POST')){
    reply(res,405,{error:'Método inválido'});return;
  }
  try{
    if(action==='status' && !nodes.has(id) && !authorized.has(id)){
      reply(res,200,{status:'desconectado',phone:null,qr:null});return;
    }
    if(action==='start')authorized.add(id);
    if(action==='logout'){
      authorized.delete(id); // do not automatically resurrect this company
      const node=await spawnCompany(id); // allows cleanup of this company's LocalAuth only
      await proxy(req,res,node,id,action);
      stopNode(id,node);
      return;
    }
    const node=await spawnCompany(id);
    await proxy(req,res,node,id,action);
  }catch(e){reply(res,e.httpCode||503,{error:`Empresa ${id}: ${e.message}`});}
});
server.on('error',e=>{console.error('[AUROX] porta do roteador indisponível:',e.message);process.exit(1);});
server.listen(PORT,'0.0.0.0',()=>{
  console.info(`[AUROX] gerenciador multiempresa ativo na porta ${PORT}; ${MAX} sessões; 1 processo por empresa`);
  void bootstrap();
});
setInterval(()=>{void bootstrap();},120000).unref();
startPushDispatcher(BASE); // exactly once; child sessions do not run these schedules
async function shutdown(){
  if(stopping)return;
  stopping=true;
  server.close();
  const current=[...nodes.entries()];
  const exited=current.map(([,node])=>new Promise(resolve=>{
    if(node.exited || !node.process)return resolve();
    node.process.once('exit',resolve);
  }));
  for(const [id,node] of current)stopNode(id,node); // preserve login data; no remote logout
  await Promise.race([Promise.allSettled(exited),new Promise(r=>setTimeout(r,9000))]);
  process.exit(0);
}
process.once('SIGINT',()=>{void shutdown();});
process.once('SIGTERM',()=>{void shutdown();});
