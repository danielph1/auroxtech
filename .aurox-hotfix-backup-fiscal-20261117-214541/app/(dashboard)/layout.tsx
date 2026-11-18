'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {X} from 'lucide-react';
import './workspace.css';
import './nova-studio.css';
import './studio-ui.css';
import './studio-operacional.css';
import './studio-ajustes-v3.css';
import './aurox-mobile-v5.css';
import './aurox-modal-v2.css';
import {ProtectedRoute} from '@/components/protected-route';
import {SidebarNav} from '@/components/sidebar-nav';
import {AuroxTopbar} from '@/components/aurox-topbar';
import {AvisosFlutuante} from '@/components/avisos-flutuante';
import {BottomNav} from '@/components/bottom-nav';
import {useAuth} from '@/contexts/auth-context';
import {permiteRota} from '@/lib/permissoes-acesso';
import {useRealtimeCore} from '@/hooks/use-realtime';
function RealtimeBootstrap(){useRealtimeCore();return null;}
export default function DashboardLayout({children}:{children:ReactNode}){
 const [open,setOpen]=useState(false);const path=usePathname()||'';const {user}=useAuth();
 const touch=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>setOpen(false),[path]);
 useEffect(()=>{function start(e:TouchEvent){const p=e.touches[0];touch.current=p&&p.clientX<26?{x:p.clientX,y:p.clientY}:null;}
 function move(e:TouchEvent){const p=e.touches[0],s=touch.current;if(s&&p&&p.clientX-s.x>70&&Math.abs(p.clientY-s.y)<42){setOpen(true);touch.current=null;}}
 window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});return()=>{window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);};},[]);
 return <ProtectedRoute><RealtimeBootstrap/><div className="nova-app-shell">
  <div className={'nova-sidebar-container'+(open?' is-open':'')}><SidebarNav onNavigate={()=>setOpen(false)}/></div>
  {open&&<button type="button" aria-label="Fechar menu" className="nova-mobile-overlay" onClick={()=>setOpen(false)}/>} 
  <div className="nova-content-shell"><AuroxTopbar onMenu={()=>setOpen(v=>!v)}/><main className="nova-workspace-main">
   {permiteRota(user?.tipo,path)?children:<section className="nova-surface mx-auto max-w-lg p-7" role="alert"><h1 className="text-xl font-bold">Acesso restrito</h1><p className="mt-2 text-muted-foreground">Seu cargo não tem permissão para esta área.</p></section>}
  </main></div><AvisosFlutuante/><BottomNav/></div></ProtectedRoute>;
}
