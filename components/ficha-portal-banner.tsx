'use client';
import {useEffect,useState} from 'react';
import {BANNERS_PORTAL,TEMA_PADRAO} from '@/lib/ficha-portal-tema';
type Tema=typeof TEMA_PADRAO;
export function FichaPortalBanner({tema,compact=false}:{tema:Tema;compact?:boolean}){
 const [index,setIndex]=useState(0);
 const selected=(Array.isArray(tema.banners)?tema.banners:[0,1,2]).filter(n=>Number.isInteger(n)&&n>=0&&n<BANNERS_PORTAL.length).slice(0,3);
 const indexes=tema.modo_banner==='carrossel'?selected:tema.modo_banner==='estatico'?[selected[0]??0]:[];
 useEffect(()=>{setIndex(0)},[tema.campanha,tema.modo_banner,tema.banners.join(',')]);
 useEffect(()=>{if(indexes.length<2)return;const timer=setInterval(()=>setIndex(v=>(v+1)%indexes.length),6500);return()=>clearInterval(timer)},[indexes.join(',')]);
 if(!indexes.length)return null;
 const current=indexes[index%indexes.length];
 return <div className="relative isolate overflow-hidden rounded-xl bg-slate-950" aria-label="Banner ilustrativo de campanha">
  <img src={BANNERS_PORTAL[current]} alt={`Campanha de veículos: ${tema.campanha}`} loading="lazy" decoding="async" className={`w-full object-cover ${compact?'h-28 sm:h-36':'h-36 sm:h-48'}`}/>
  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/25 to-transparent pointer-events-none"/>
  <div className="absolute left-3 top-3 flex max-w-[70%] flex-col gap-1 text-white drop-shadow-lg sm:left-5 sm:top-4">
   {tema.logo_data_uri&&<span className="mb-1 flex w-fit max-w-full items-center rounded-lg bg-white/95 p-1.5 shadow-sm"><img src={tema.logo_data_uri} alt={`Logo de ${tema.empresa_nome||'concessionária'}`} className="max-h-11 max-w-28 object-contain sm:max-h-14 sm:max-w-44"/></span>}
   <strong className="max-w-full break-words text-sm font-extrabold leading-tight sm:text-lg">{tema.empresa_nome||'Concessionária'}</strong>
   <span className="w-fit rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider sm:text-xs">{({institucional:'Seja bem-vindo',promocao:'Promoção',feirao:'Feirão',natal:'Natal',ofertao:'Ofertão'} as const)[tema.campanha]||'Bem-vindo'}</span>
  </div>
  {indexes.length>1&&<div className="absolute bottom-2 right-3 flex items-center gap-2">
   <button type="button" aria-label="Banner anterior" className="rounded-full bg-black/60 px-2 py-1 text-sm text-white" onClick={()=>setIndex(v=>(v-1+indexes.length)%indexes.length)}>‹</button>
   <span className="text-xs text-white">{index+1}/{indexes.length}</span>
   <button type="button" aria-label="Próximo banner" className="rounded-full bg-black/60 px-2 py-1 text-sm text-white" onClick={()=>setIndex(v=>(v+1)%indexes.length)}>›</button>
  </div>}
 </div>;
}
