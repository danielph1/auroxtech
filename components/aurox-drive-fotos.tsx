'use client';
import {useEffect,useState} from 'react';
import {FolderOpen,Link2,RefreshCcw,Images,Loader2,CheckCircle2} from 'lucide-react';
import {api} from '@/lib/api';
import {toast} from 'sonner';

type Item={nome:string;placa:string;carro_id:number|null;motivo:string};
type Preview={total:number;elegiveis:number;pendentes:number;amostra:Item[]};
export function AuroxDriveFotos({empresaId}:{empresaId:number}){
 const [connected,setConnected]=useState(false),[busy,setBusy]=useState(false),[folder,setFolder]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[count,setCount]=useState<number|null>(null);
 useEffect(()=>{setPreview(null);setCount(null);setConnected(false);setFolder('');
  if(!empresaId)return;let live=true;api.get('/importacoes/drive',{params:{empresa_id:empresaId}}).then(r=>{if(live)setConnected(!!r.data?.conectado);}).catch(()=>{});
  return()=>{live=false;};
 },[empresaId]);
 async function connect(){setBusy(true);try{const r=await api.get('/importacoes/drive/start',{params:{empresa_id:empresaId}});const url=String(r.data?.url||'');
  if(!url.startsWith('https://accounts.google.com/'))throw new Error('Endereço do Google inválido.');
  window.location.assign(url);
 }catch(e:any){toast.error(e?.response?.data?.error||e.message||'Não foi possível conectar ao Drive.');setBusy(false);}}
 async function run(acao:'preview'|'sincronizar'){setBusy(true);try{
  const {data}=await api.post('/importacoes/drive',{empresa_id:empresaId,pasta:folder,acao},{timeout:120000});
  if(acao==='preview'){setPreview(data);setCount(null);}else{setCount((v)=>(v||0)+Number(data.importadas||0));
   toast.success(`${data.importadas||0} foto(s) associada(s).`);if(data.falhas)toast.warning(`${data.falhas} falha(s) ao importar fotos.`);
  }
 }catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível consultar o Google Drive.');}
 finally{setBusy(false);}}
 async function disconnect(){if(!window.confirm('Desconectar o Google Drive desta empresa? As fotos já importadas serão preservadas.'))return;
  setBusy(true);try{await api.delete('/importacoes/drive',{params:{empresa_id:empresaId}});setConnected(false);setPreview(null);toast.success('Drive desconectado.');}
  catch{toast.error('Falha ao desconectar.');}finally{setBusy(false);}}
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
  <div className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1">
   <div className="flex items-center gap-2 font-semibold"><FolderOpen size={18} className="text-primary"/> Fotos do Google Drive</div>
   <p className="text-xs text-muted-foreground">Associe as fotos do Drive ao estoque pela placa no nome do arquivo ou pasta. Somente veículos desta empresa.</p>
   </div><span className="rounded-full border px-3 py-1 text-xs">{connected?'Drive conectado':'Precisa conectar'}</span>
  </div>
  {!connected?<button type="button" disabled={busy} onClick={()=>void connect()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Link2 size={16}/> Conectar Google Drive</button>:<>
    <label className="block text-sm font-medium">Link da pasta de fotos
     <input className="mt-1 block w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm" value={folder} onChange={e=>{setFolder(e.target.value);setPreview(null);setCount(null);}}
      placeholder="https://drive.google.com/drive/folders/…" />
    </label>
    <div className="flex flex-wrap gap-2">
     <button disabled={busy||!folder} onClick={()=>void run('preview')} className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-40">{busy?<Loader2 size={16} className="animate-spin"/>:<RefreshCcw size={16}/>} Conferir fotos</button>
     {preview&&preview.elegiveis>0&&<button disabled={busy} onClick={()=>void run('sincronizar')} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Images size={16}/> Associar até 8 fotos</button>}
    </div>
    {preview&&<div className="space-y-2 rounded-xl bg-muted/50 p-3 text-xs">
     <p className="font-semibold">Encontradas {preview.total} foto(s) · {preview.elegiveis} elegível(is) · {preview.pendentes} pendente(s)</p>
     <div className="max-h-56 space-y-1 overflow-y-auto">{preview.amostra.map((x,i)=><div className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-1.5" key={i}>
      <span className="break-all">{x.nome}</span><span className={x.carro_id&&!x.motivo?'text-primary':'text-muted-foreground'}>{x.motivo||`Placa ${x.placa} → veículo #${x.carro_id}`}</span>
     </div>)}</div>
    </div>}
    {count!==null&&<p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 size={16}/> {count} foto(s) importada(s) nesta sessão. Clique novamente para continuar o lote.</p>}
    <button type="button" onClick={()=>void disconnect()} className="text-xs text-muted-foreground underline hover:text-destructive" disabled={busy}>Desconectar esta empresa do Google Drive</button>
   </>}
  <p className="text-xs text-muted-foreground">Reconhece ABC1234 e ABC1D23 em nomes e pastas. Fotos sem placa, ambíguas ou com veículo inexistente ficam pendentes. Máximo de 20 fotos por veículo.</p>
 </section>;
}
