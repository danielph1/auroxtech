'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuroxModulos} from '@/hooks/use-aurox-modulos';
import {useAuth} from '@/contexts/auth-context';
import {CalendarDays,Home,LayoutDashboard,MessageCircle,Settings2,ClipboardCheck} from 'lucide-react';
export function BottomNav(){
 const [mounted,setMounted]=useState(false);const [hidden,setHidden]=useState(false);const path=usePathname()||'';const {user}=useAuth();const {pode:acessoModulo}=useAuroxModulos();
 useEffect(()=>setMounted(true),[]);
 useEffect(()=>setHidden(false),[path]);
 useEffect(()=>{
  if(!mounted)return;
  let lastY=window.scrollY;let lastAt=0;
  const onScroll=(event:Event)=>{
   const el=event.target instanceof Element?event.target:document.scrollingElement;
   if(el instanceof Element && el.closest('[role="dialog"],.studio-overlay,.nova-modal-backdrop'))return;
   const top=el?el.scrollTop:window.scrollY;
   if(top<12){setHidden(false);lastY=top;return;}
   const delta=top-lastY;
   if(Math.abs(delta)>9 && Date.now()-lastAt>80){setHidden(delta>0);lastY=top;lastAt=Date.now();}
  };
  document.addEventListener('scroll',onScroll,true);
  return()=>document.removeEventListener('scroll',onScroll,true);
 },[mounted]);
 if(!mounted)return null;
 const role=String(user?.tipo||'').toLowerCase();
 const items=[{href:'/inicio',label:'Início',icon:Home},{href:'/agenda',label:'Agenda',icon:CalendarDays},
 ...( ['superadmin','admin','gerente','marketing','vendedor'].includes(role)?[{href:'/painel',label:'Leads',icon:LayoutDashboard},{href:'/chat',label:'Chat',icon:MessageCircle}]:[{href:'/tarefas',label:'Tarefas',icon:ClipboardCheck}]),
 {href:'/configuracoes',label:'Mais',icon:Settings2}];
 return createPortal(<nav className={"nova-mobile-dock"+(hidden?" is-hidden":"")} aria-label="Navegação móvel">{items.filter(item=>acessoModulo(item.href)).map(item=>{const I=item.icon,selected=path===item.href||path.startsWith(item.href+'/');return <Link key={item.href} href={item.href} aria-current={selected?'page':undefined} className={selected?'is-active':''}><I size={19}/><span>{item.label}</span></Link>})}</nav>,document.body);
}
