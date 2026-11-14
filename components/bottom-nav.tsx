'use client';
import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useAuth} from '@/contexts/auth-context';
import {CalendarDays,Home,LayoutDashboard,MessageCircle,Settings2,ClipboardCheck} from 'lucide-react';
export function BottomNav(){
 const [mounted,setMounted]=useState(false);const path=usePathname()||'';const {user}=useAuth();
 useEffect(()=>setMounted(true),[]);if(!mounted)return null;
 const role=String(user?.tipo||'').toLowerCase();
 const items=[{href:'/inicio',label:'Início',icon:Home},{href:'/agenda',label:'Agenda',icon:CalendarDays},
 ...( ['superadmin','admin','gerente','marketing','vendedor'].includes(role)?[{href:'/painel',label:'Leads',icon:LayoutDashboard},{href:'/chat',label:'Chat',icon:MessageCircle}]:[{href:'/tarefas',label:'Tarefas',icon:ClipboardCheck}]),
 {href:'/configuracoes',label:'Mais',icon:Settings2}];
 return createPortal(<nav className="nova-mobile-dock" aria-label="Navegação móvel">{items.map(item=>{const I=item.icon,selected=path===item.href||path.startsWith(item.href+'/');return <Link key={item.href} href={item.href} aria-current={selected?'page':undefined} className={selected?'is-active':''}><I size={19}/><span>{item.label}</span></Link>})}</nav>,document.body);
}
