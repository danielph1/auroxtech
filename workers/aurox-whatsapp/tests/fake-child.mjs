import http from 'node:http';
const id=Number(process.env.AUROX_WA_ONLY_EMPRESA_ID);
const port=Number(process.env.PORT);
const secret=String(process.env.AUROX_WA_WORKER_SECRET);
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://internal');
  res.setHeader('Content-Type','application/json');
  if(req.headers.authorization!==`Bearer ${secret}`){res.writeHead(401);res.end(JSON.stringify({error:'not authorized'}));return;}
  if(!u.pathname.startsWith(`/v1/sessions/${id}/`)){res.writeHead(403);res.end(JSON.stringify({error:'wrong company'}));return;}
  if(u.pathname.endsWith('/status')){res.end(JSON.stringify({status:'conectado',phone:String(550000000000+id)}));return;}
  if(u.pathname.endsWith('/start')){res.writeHead(202);res.end(JSON.stringify({ok:true,status:'conectado'}));return;}
  if(u.pathname.endsWith('/logout')){res.end(JSON.stringify({ok:true}));return;}
  if(u.pathname.endsWith('/send')){res.end(JSON.stringify({ok:true,empresa_id:id}));return;}
  res.writeHead(404);res.end('{}');
});
server.listen(port,'127.0.0.1');
