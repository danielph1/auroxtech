'use client';
import {useEffect,useState} from 'react';
import {useAuth} from '@/contexts/auth-context';
import {api} from '@/lib/api';
import {TEMA_PADRAO,CAMPANHAS_PORTAL,BANNERS_PORTAL,normalizarConteudosBanner,type CampanhaPortal,type ConteudoBanner} from '@/lib/ficha-portal-tema';
import {FichaPortalBanner} from '@/components/ficha-portal-banner';
import {toast} from 'sonner';
import Link from 'next/link';
import {ArrowLeft,ImagePlus,ShieldCheck,Smartphone,Monitor,Tag,Flag,Gift,Megaphone,type LucideIcon} from 'lucide-react';
const roles=['superadmin','admin','gerente','marketing'];
const iconesCampanha:Record<CampanhaPortal,LucideIcon>={institucional:ShieldCheck,promocao:Tag,feirao:Flag,natal:Gift,ofertao:Megaphone};
const field='w-full rounded-lg border border-border bg-background p-3 text-sm';
export default function PersonalizarFicha(){
 const {user}=useAuth();const papel=String(user?.tipo||'').toLowerCase();const [empresaId,setEmpresaId]=useState('');
 const [tema,setTema]=useState({...TEMA_PADRAO}),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const [loja,setLoja]=useState(''),[preview,setPreview]=useState<'mobile'|'desktop'>('mobile');
 const [bannerEditando,setBannerEditando]=useState(0);
 const adminGlobal=papel==='superadmin';
 async function carregar(empresa:string,lojaAtual:string){setLoaded(false);try{const r=await api.get('/fichas/portal/tema',{params:{...(adminGlobal?{empresa_id:empresa}:{}),loja:lojaAtual}});setTema({...TEMA_PADRAO,...r.data.tema,banner_conteudos:normalizarConteudosBanner(r.data.tema?.banner_conteudos)});setLoaded(true)}catch(e:any){toast.error(e?.response?.data?.error||'Falha ao carregar tema')}}
 useEffect(()=>{if(!user||!roles.includes(papel))return;const e=adminGlobal?'':String(user.empresa_id||'');const l=papel==='gerente'?String(user.loja||''):'';setEmpresaId(e);setLoja(l);if(!adminGlobal&&e)void carregar(e,l)},[user?.id,papel]);
 async function salvar(){setBusy(true);try{await api.put('/fichas/portal/tema',{...(adminGlobal?{empresa_id:Number(empresaId)}:{}),loja,tema});toast.success('Personalização salva')}catch(e:any){toast.error(e?.response?.data?.error||'Falha ao salvar')}finally{setBusy(false)}}
 async function image(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;
  if(file.size>110_000||!['image/png','image/jpeg','image/webp'].includes(file.type)){toast.error('Use PNG, JPEG ou WebP de até 110 KB');return}
  const reader=new FileReader();reader.onload=()=>setTema(t=>({...t,logo_data_uri:String(reader.result)}));reader.readAsDataURL(file);
 }
 const conteudoEditando=normalizarConteudosBanner(tema.banner_conteudos)[bannerEditando];
 function editarBanner(k:keyof ConteudoBanner,v:string){
  setTema(t=>{const arr=normalizarConteudosBanner(t.banner_conteudos);arr[bannerEditando]={...arr[bannerEditando],
   [k]:k==='desconto_percentual'?(v===''?null:Number(v)):v};return {...t,banner_conteudos:arr}});
 }
 if(!roles.includes(papel))return <section className="p-7">Sem permissão para personalizar fichas.</section>;
 return <section className="mx-auto max-w-7xl space-y-5"><Link href="/fichas" className="inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={16}/>Voltar às fichas</Link>
  <div><h1 className="text-2xl font-bold">Personalização do Portal de Fichas</h1><p className="text-sm text-muted-foreground">Cores, campanha e banner com prévia para celular e computador. Nunca permite HTML ou scripts externos.</p></div>
  <div className="grid gap-5 lg:grid-cols-[minmax(0,390px)_1fr]">
   <div className="space-y-4 rounded-2xl border bg-card p-5">
    {adminGlobal&&<label className="block text-sm">ID da empresa<input type="number" min={1} value={empresaId} onChange={e=>setEmpresaId(e.target.value)} className={field}/></label>}
    {papel!=='gerente'&&<label className="block text-sm">Código da loja (vazio = padrão da empresa)<input className={field} maxLength={30} value={loja} onChange={e=>setLoja(e.target.value)}/></label>}
    <button type="button" className="w-full rounded-lg border p-2 text-sm" onClick={()=>void carregar(empresaId,loja)} disabled={!empresaId}>Carregar identidade da loja</button>
    <div className="space-y-2"><h2 className="text-sm font-semibold">Tema da campanha (opcional)</h2><div className="grid grid-cols-3 gap-2">
     {CAMPANHAS_PORTAL.map(c=>{const Icon=iconesCampanha[c.id];return <button type="button" key={c.id} onClick={()=>{const idx=['promocao','feirao','natal','ofertao'].indexOf(c.id);setTema(t=>{
       if(idx<0)return {...t,campanha:c.id};
       const modo=t.modo_banner==='nenhum'?'estatico':t.modo_banner;
       const banners=modo==='estatico'?[idx]:t.banners.includes(idx)?t.banners:[...t.banners.slice(-2),idx];
       return {...t,campanha:c.id,modo_banner:modo,banners};
      });if(idx>=0)setBannerEditando(idx)}} aria-pressed={tema.campanha===c.id} className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border p-2 text-xs ${tema.campanha===c.id?'border-teal-500 bg-teal-500/10 font-semibold':'border-border'}`}><Icon size={20} aria-hidden="true"/>{c.rotulo}</button>})}
    </div></div>
    <div className="space-y-2"><h2 className="text-sm font-semibold">Imagem no topo</h2>
     <div className="grid grid-cols-3 gap-2">{([['nenhum','Sem imagem'],['estatico','Estática'],['carrossel','Carrossel']] as const).map(([modo,nome])=><button type="button" key={modo} aria-pressed={tema.modo_banner===modo} onClick={()=>setTema(t=>({...t,modo_banner:modo}))} className={`rounded-lg border p-2 text-xs ${tema.modo_banner===modo?'border-teal-500 bg-teal-500/10':''}`}>{nome}</button>)}</div>
     {tema.modo_banner!=='nenhum'&&<div className="grid grid-cols-2 gap-2">{BANNERS_PORTAL.map((url,i)=><button type="button" key={i} onClick={()=>{setBannerEditando(i);setTema(t=>({...t,banners:t.modo_banner==='estatico'?[i]:t.banners.includes(i)?t.banners.filter(x=>x!==i):[...t.banners,i].slice(-3)}))}} className={`relative overflow-hidden rounded-lg border-2 ${tema.banners.includes(i)?'border-teal-500':'border-transparent'} ${bannerEditando===i?'ring-2 ring-teal-400':''}`}><img src={url} alt={['Promoção','Feirão','Natal','Ofertão'][i]} className="h-16 w-full object-cover"/><span className="block bg-card p-1 text-xs">{['Promoção','Feirão','Natal','Ofertão'][i]}</span></button>)}</div>}
     <p className="text-xs text-muted-foreground">Modelos visuais prontos para Promoção, Feirão, Natal e Ofertão. Edite o texto de cada banner abaixo; sua marca é inserida pelo portal. Máximo de 3 imagens por página.</p>
    </div>
    {tema.modo_banner!=='nenhum'&&<section className="space-y-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3" aria-label="Conteúdo individual dos banners">
     <div><h3 className="text-sm font-semibold">Informações de cada banner</h3><p className="mt-1 text-xs text-muted-foreground">Escolha abaixo qual imagem deseja editar. Cada campanha conserva os próprios textos e percentual opcional.</p></div>
     <div className="grid grid-cols-4 gap-1">{['Promoção','Feirão','Natal','Ofertão'].map((label,i)=><button type="button" key={i} onClick={()=>setBannerEditando(i)} className={`rounded-md border px-1 py-2 text-[11px] ${bannerEditando===i?'border-teal-500 bg-teal-500/15 font-semibold':'border-border'}`}>{label}</button>)}</div>
     <label className="block text-xs font-medium">Selo de destaque<input className={field} value={conteudoEditando.destaque} maxLength={40} onChange={e=>editarBanner('destaque',e.target.value)}/></label>
     <label className="block text-xs font-medium">Título deste banner<input className={field} value={conteudoEditando.titulo} maxLength={60} onChange={e=>editarBanner('titulo',e.target.value)}/></label>
     <label className="block text-xs font-medium">Informações / mensagem deste banner<textarea rows={2} className={field} value={conteudoEditando.subtitulo} maxLength={110} onChange={e=>editarBanner('subtitulo',e.target.value)}/></label>
     <label className="block text-xs font-medium">Desconto anunciado (%) — opcional<input className={field} type="number" min={1} max={99} step={1} placeholder="Sem percentual" value={conteudoEditando.desconto_percentual??''} onChange={e=>editarBanner('desconto_percentual',e.target.value)}/></label>
     <p className="text-xs text-muted-foreground">O percentual só aparece quando preenchido. Informe apenas descontos reais, verificáveis e aplicáveis à oferta da sua concessionária.</p>
    </section>}
    <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-sm"><input type="checkbox" className="mt-1 accent-teal-600" checked={tema.veiculo_obrigatorio!==false} onChange={e=>setTema(t=>({...t,veiculo_obrigatorio:e.target.checked}))}/><span><strong>Exigir veículo de interesse</strong><span className="mt-1 block text-xs text-muted-foreground">Configuração desta loja. Desmarque para o cliente poder enviar a ficha sem escolher um veículo. Um veículo já salvo no lead não será apagado.</span></span></label>
    <label className="block text-sm">Título<input className={field} maxLength={90} value={tema.titulo} onChange={e=>setTema(t=>({...t,titulo:e.target.value}))}/></label>
    <label className="block text-sm">Mensagem de abertura<textarea className={field} rows={3} maxLength={280} value={tema.mensagem} onChange={e=>setTema(t=>({...t,mensagem:e.target.value}))}/></label>
    {([['cor_primaria','Cor principal'],['cor_fundo','Fundo'],['cor_texto','Texto']] as const).map(([k,label])=><label key={k} className="flex items-center justify-between gap-3 text-sm">{label}<input type="color" aria-label={label} value={tema[k]} onChange={e=>setTema(t=>({...t,[k]:e.target.value}))}/></label>)}
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm"><ImagePlus size={18}/> Logo da loja (PNG/JPEG/WebP, até 110 KB)<input type="file" className="sr-only" accept="image/png,image/jpeg,image/webp" onChange={e=>void image(e)}/></label>
    {tema.logo_data_uri&&<button type="button" className="text-xs text-destructive underline" onClick={()=>setTema(t=>({...t,logo_data_uri:null}))}>Remover logo</button>}
    <button disabled={!loaded||busy} type="button" onClick={()=>void salvar()} className="w-full rounded-xl bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-50">{busy?'Salvando...':'Salvar personalização'}</button>
   </div>
   <div className="space-y-3"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Prévia da concessionária: {tema.empresa_nome||'Concessionária'}</h2><div className="flex rounded-lg border p-1 gap-1"><button type="button" className={`rounded px-3 py-2 text-xs ${preview==='mobile'?'bg-primary text-primary-foreground':''}`} onClick={()=>setPreview('mobile')}><Smartphone size={14} className="inline"/> Celular</button><button type="button" className={`rounded px-3 py-2 text-xs ${preview==='desktop'?'bg-primary text-primary-foreground':''}`} onClick={()=>setPreview('desktop')}><Monitor size={14} className="inline"/> Computador</button></div></div>
    <div className="rounded-2xl border p-3 sm:p-5" style={{backgroundColor:tema.cor_fundo,color:tema.cor_texto}}>
     <div className={`mx-auto overflow-hidden rounded-2xl bg-white shadow-lg transition-all ${preview==='mobile'?'max-w-[390px]':'max-w-3xl'}`}>
      <FichaPortalBanner tema={tema} compact={preview==='mobile'}/>
      <div className="p-5 text-white" style={{backgroundColor:tema.cor_primaria}}>{tema.logo_data_uri&&<img src={tema.logo_data_uri} alt="Logo" className="mb-2 max-h-12 max-w-36 object-contain"/>}<p className="flex items-center gap-2 text-xs"><ShieldCheck size={15}/> Portal seguro · {tema.empresa_nome||'Concessionária'}</p><h2 className="mt-2 text-xl font-bold">{tema.titulo}</h2><p className="mt-2 text-xs">{tema.mensagem}</p></div>
      <div className={`grid gap-3 p-5 text-slate-900 ${preview==='desktop'?'sm:grid-cols-2':''}`}>
       {['Nome completo','Telefone (WhatsApp)','CPF','Data de nascimento','Veículo de interesse','Valor de entrada (R$)','Habilitado (possui CNH)? — Sim / Não'].map(k=><div key={k}><label className="text-xs font-semibold">{k}{k==='Veículo de interesse'&&tema.veiculo_obrigatorio===false?' (opcional)':' *'}</label><div className="mt-1 h-9 rounded-lg border border-slate-200 bg-slate-50"/></div>)}
       <div className="rounded-lg p-3 text-center text-sm font-semibold text-white sm:col-span-2" style={{backgroundColor:tema.cor_primaria}}>Confirmar e enviar ficha</div>
      </div>
     </div>
    </div><p className="text-xs text-muted-foreground">Prévia ilustrativa, sem dados de clientes. Nome obtido do cadastro da empresa e logo enviada por ela; nenhuma marca do fornecedor aparece para o cliente.</p>
   </div>
  </div>
 </section>;
}
