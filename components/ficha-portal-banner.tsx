'use client';
import {useEffect,useState} from 'react';
import {BANNERS_PORTAL,normalizarConteudosBanner,TEMA_PADRAO} from '@/lib/ficha-portal-tema';
type Tema=typeof TEMA_PADRAO;
export function FichaPortalBanner({tema,compact=false}:{tema:Tema;compact?:boolean}){
 const [index,setIndex]=useState(0);
 const selected=(Array.isArray(tema.banners)?tema.banners:[0]).filter(n=>Number.isInteger(n)&&n>=0&&n<BANNERS_PORTAL.length).slice(0,3);
 const indexes=tema.modo_banner==='carrossel'?selected:tema.modo_banner==='estatico'?[selected[0]??0]:[];
 const ids=indexes.join(',');
 useEffect(()=>{setIndex(0)},[tema.modo_banner,ids]);
 useEffect(()=>{if(indexes.length<2)return;const timer=setInterval(()=>setIndex(v=>(v+1)%indexes.length),6500);return()=>clearInterval(timer)},[ids]);
 if(!indexes.length)return null;
 const current=indexes[index%indexes.length];
 const conteudo=normalizarConteudosBanner(tema.banner_conteudos)[current];
 return <section className="relative isolate overflow-hidden rounded-xl bg-slate-950" aria-label={`Campanha: ${conteudo.destaque||'Veículos'}`}>
  <img src={BANNERS_PORTAL[current]} alt={`Veículos da campanha ${conteudo.destaque||'especial'}`} loading="lazy" decoding="async" className={`w-full object-cover ${compact?'h-44 sm:h-48':'h-48 sm:h-56'}`}/>
  <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-transparent"/>
  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[67%] flex-col justify-center gap-1.5 px-3 py-3 text-white drop-shadow-lg sm:w-[60%] sm:px-5">
   {tema.logo_data_uri&&<span className="flex w-fit max-w-full items-center rounded-md bg-white/95 px-2 py-1 shadow-sm"><img src={tema.logo_data_uri} alt={`Logo de ${tema.empresa_nome||'concessionária'}`} className="max-h-8 max-w-24 object-contain sm:max-h-11 sm:max-w-32"/></span>}
   <span className="line-clamp-1 break-words text-xs font-bold sm:text-base">{tema.empresa_nome||'Concessionária'}</span>
   {conteudo.destaque&&<span className="w-fit max-w-full rounded-md bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:text-xs">{conteudo.destaque}</span>}
   {conteudo.titulo&&<strong className="line-clamp-2 break-words text-sm font-extrabold leading-tight sm:text-lg">{conteudo.titulo}</strong>}
   {conteudo.subtitulo&&<p className="line-clamp-2 break-words text-[10px] leading-tight text-slate-100 sm:text-xs">{conteudo.subtitulo}</p>}
   {conteudo.desconto_percentual!==null&&<span className="mt-1 w-fit rounded-md bg-amber-400 px-2 py-1 text-[11px] font-extrabold text-slate-950 sm:text-sm">{conteudo.desconto_percentual}% de desconto</span>}
  </div>
  {indexes.length>1&&<div className="absolute bottom-1.5 right-2 flex items-center gap-1.5 rounded-full bg-slate-900/60 p-1.5">
   <button type="button" aria-label="Banner anterior" className="rounded-full px-2 text-sm text-white" onClick={()=>setIndex(v=>(v-1+indexes.length)%indexes.length)}>‹</button>
   <span className="text-xs text-white" aria-live="polite">{index+1}/{indexes.length}</span>
   <button type="button" aria-label="Próximo banner" className="rounded-full px-2 text-sm text-white" onClick={()=>setIndex(v=>(v+1)%indexes.length)}>›</button>
  </div>}
 </section>;
}
