'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/contexts/auth-context';
import {api} from '@/lib/api';
import {TEMA_PADRAO} from '@/lib/ficha-portal-tema';
import {toast} from 'sonner';
import Link from 'next/link';
import {ArrowLeft,ImagePlus,ShieldCheck} from 'lucide-react';
const roles=['superadmin','admin','gerente','marketing'];
const field='w-full rounded-lg border border-border bg-background p-3 text-sm';
export default function PersonalizarFicha(){
 const {user}=useAuth();const papel=String(user?.tipo||'').toLowerCase();const [empresaId,setEmpresaId]=useState('');
 const [tema,setTema]=useState({...TEMA_PADRAO}),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [loja,setLoja]=useState('');
 const adminGlobal=papel==='superadmin';
 async function carregar(empresa:string,lojaAtual:string){setLoaded(false);try{const r=await api.get('/fichas/portal/tema',{params:{...(adminGlobal?{empresa_id:empresa}:{}),loja:lojaAtual}});setTema({...TEMA_PADRAO,...r.data.tema});setLoaded(true)}catch(e:any){toast.error(e?.response?.data?.error||'Falha ao carregar tema')}}
 useEffect(()=>{if(!user||!roles.includes(papel))return;
  const e=adminGlobal?'':String(user.empresa_id||'');const l=papel==='gerente'?String(user.loja||''):'';
  setEmpresaId(e);setLoja(l);if(!adminGlobal&&e)void carregar(e,l);
 },[user?.id,papel]);
 async function salvar(){setBusy(true);try{await api.put('/fichas/portal/tema',{...(adminGlobal?{empresa_id:Number(empresaId)}:{}),loja,tema});toast.success('Personalização salva')}catch(e:any){toast.error(e?.response?.data?.error||'Falha ao salvar')}finally{setBusy(false)}}
 async function image(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;
  if(file.size>110_000||!['image/png','image/jpeg','image/webp'].includes(file.type)){toast.error('Use PNG, JPEG ou WebP de até 110 KB');return}
  const reader=new FileReader();reader.onload=()=>setTema(t=>({...t,logo_data_uri:String(reader.result)}));reader.readAsDataURL(file);
 }
 if(!roles.includes(papel))return <section className="p-7">Sem permissão para personalizar fichas.</section>;
 return <section className="mx-auto max-w-6xl space-y-5"><Link href="/fichas" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16}/>Voltar às fichas</Link>
  <div><h1 className="text-2xl font-bold">Personalização da ficha do cliente</h1><p className="text-sm text-muted-foreground">Ajuste as cores e a logo. A prévia funciona localmente, sem consultar dados de clientes.</p></div>
  <div className="grid gap-6 lg:grid-cols-[minmax(0,370px)_1fr]">
   <div className="space-y-4 rounded-2xl border bg-card p-5">
    {adminGlobal&&<label className="block text-sm">ID da empresa a personalizar<input type="number" min={1} value={empresaId} onChange={e=>setEmpresaId(e.target.value)} className={field}/></label>}
    {papel!=='gerente'&&<label className="block text-sm">Código da loja (opcional; vazio = tema padrão da empresa)<input className={field} maxLength={30} value={loja} onChange={e=>setLoja(e.target.value)}/></label>}
    <button type="button" className="w-full rounded-lg border border-border p-2 text-sm" onClick={()=>void carregar(empresaId,loja)} disabled={!empresaId}>Carregar tema</button>
    <label className="block text-sm">Título<input className={field} maxLength={90} value={tema.titulo} onChange={e=>setTema(t=>({...t,titulo:e.target.value}))}/></label>
    <label className="block text-sm">Mensagem de abertura<textarea className={field} rows={3} maxLength={280} value={tema.mensagem} onChange={e=>setTema(t=>({...t,mensagem:e.target.value}))}/></label>
    {([['cor_primaria','Cor principal'],['cor_fundo','Fundo'],['cor_texto','Texto']] as const).map(([k,label])=><label key={k} className="flex items-center justify-between gap-3 text-sm">{label}<input type="color" aria-label={label} value={tema[k]} onChange={e=>setTema(t=>({...t,[k]:e.target.value}))}/></label>)}
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm"><ImagePlus size={18}/> Logo da concessionária (PNG/JPEG/WebP, até 110 KB)<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={e=>void image(e)}/></label>
    {tema.logo_data_uri&&<button type="button" className="text-xs text-destructive underline" onClick={()=>setTema(t=>({...t,logo_data_uri:null}))}>Remover logo</button>}
    <button disabled={!loaded||busy} type="button" onClick={()=>void salvar()} className="w-full rounded-xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50">{busy?'Salvando...':'Salvar aparência'}</button>
   </div>
   <div className="space-y-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prévia leve · tela de celular e computador</p>
    <div className="rounded-2xl border p-5 sm:p-8" style={{backgroundColor:tema.cor_fundo,color:tema.cor_texto}}>
     <div className="mx-auto max-w-md overflow-hidden rounded-2xl bg-white shadow-lg">
      <div className="p-6 text-white" style={{backgroundColor:tema.cor_primaria}}>
       {tema.logo_data_uri&&<img src={tema.logo_data_uri} alt="Prévia da logo" className="mb-4 max-h-16 max-w-44 object-contain"/>}
       <p className="flex items-center gap-2 text-xs font-semibold"><ShieldCheck size={16}/> Portal seguro AUROX</p><h2 className="mt-3 text-xl font-bold">{tema.titulo}</h2><p className="mt-2 text-sm">{tema.mensagem}</p>
      </div><div className="space-y-3 p-6 text-slate-900"><p className="text-sm font-medium">Nome completo</p><div className="h-10 rounded-lg border border-slate-200"/><p className="text-sm font-medium">CPF</p><div className="h-10 rounded-lg border border-slate-200"/>
      <div className="rounded-xl p-3 text-center text-sm font-semibold text-white" style={{backgroundColor:tema.cor_primaria}}>Confirmar e enviar ficha</div></div>
     </div>
    </div><p className="text-xs text-muted-foreground">Por segurança, não é permitido inserir JavaScript ou HTML arbitrário no portal. A logo é enviada como imagem validada.</p>
   </div>
  </div></section>
}
