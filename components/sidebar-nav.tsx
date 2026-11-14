'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useState} from 'react';
import {useAuth} from '@/contexts/auth-context';
import {Activity,BarChart3,BookUser,CalendarDays,CarFront,ChartNoAxesCombined,ChevronDown,CircleHelp,ClipboardCheck,Clock3,FileText,FolderHeart,History,Home,Inbox,LayoutDashboard,LogOut,Megaphone,MessageCircleMore,PlusCircle,Receipt,Settings2,ShieldCheck,Star,Target,Users,Wallet,Wrench,ArrowLeftRight,PlugZap,Building2} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
type Item={href:string;label:string;icon:LucideIcon;roles?:string[]};
const C=['vendedor','gerente','admin','superadmin','marketing'];
const G=['gerente','admin','superadmin'];const M=['gerente','marketing','admin','superadmin'];
const CR=[...C,'elfenai','elfen_ai','elfenaí'];
const D=['superadmin','admin','gerente','vendedor','documentista','documento'];
const F=[...C,'documentista','documento'];const AD=['superadmin','admin','marketing'];
const S=[
 {id:'principal',title:'Principal',links:[{href:'/inicio',label:'Visão geral',icon:Home},{href:'/agenda',label:'Agenda',icon:CalendarDays}]},
 {id:'leads',title:'Atendimento',links:[{href:'/triagem',label:'Triagem',icon:Inbox,roles:M},{href:'/painel',label:'Painel de leads',icon:LayoutDashboard,roles:C},
 {href:'/chat',label:'Conversas',icon:MessageCircleMore,roles:C},{href:'/follow-up',label:'Follow Up',icon:FolderHeart,roles:['vendedor',...G]},
 {href:'/atendimento',label:'Gestão do atendimento',icon:Clock3,roles:M},{href:'/novo-lead',label:'Cadastrar lead',icon:PlusCircle,roles:C}]},
 {id:'comercial',title:'Comercial',links:[{href:'/fichas',label:'Fichas',icon:FileText,roles:CR},{href:'/tarefas',label:'Tarefas',icon:ClipboardCheck},
 {href:'/metas',label:'Metas',icon:Target},{href:'/metricas',label:'Métricas',icon:BarChart3,roles:M},
 {href:'/desempenho',label:'Desempenho',icon:ChartNoAxesCombined,roles:M},{href:'/ranking',label:'Ranking',icon:Star}]},
 {id:'operacao',title:'Operação',links:[{href:'/estoque',label:'Estoque',icon:CarFront},{href:'/oficina',label:'Oficina',icon:Wrench},
 {href:'/anuncios',label:'Anúncios',icon:Megaphone,roles:M},{href:'/anuncio-coletivo',label:'Anúncio coletivo',icon:Megaphone,roles:M},
 {href:'/processos',label:'Transferências',icon:ArrowLeftRight,roles:D},{href:'/faturamento',label:'Faturamento',icon:Receipt,roles:F}]},
 {id:'admin',title:'Administração',links:[{href:'/equipe',label:'Equipe',icon:Users,roles:G},
 {href:'/gestao-usuarios',label:'Usuários',icon:BookUser,roles:AD},{href:'/financas',label:'Finanças',icon:Wallet,roles:['admin','superadmin']},
 {href:'/historico',label:'Auditoria',icon:History,roles:M},{href:'/integracoes',label:'Integrações',icon:PlugZap,roles:AD},
 {href:'/aurox',label:'Gestão Aurox',icon:Building2,roles:['superadmin']},
 {href:'/configuracoes',label:'Configurações',icon:Settings2}]}
] as {id:string;title:string;links:Item[]}[];
export function SidebarNav({onNavigate}:{onNavigate?:()=>void}){
 const path=usePathname()||'';const {user,logout}=useAuth();const cargo=String(user?.tipo||'').toLowerCase();
 const [fold,setFold]=useState<Record<string,boolean>>({principal:true,leads:true});
 const active=(p:string)=>path===p||path.startsWith(p+'/');
 return <aside className="nova-sidebar" aria-label="Menu principal">
  <Link href="/inicio" className="nova-brand" onClick={onNavigate}><span className="nova-brand-mark"><Activity size={22}/></span><span><strong>AUROX</strong><small>GESTÃO AUTOMOTIVA</small></span></Link>
  <div className="nova-sidebar-scroll">{S.map(section=>{const links=section.links.filter(l=>!l.roles||l.roles.includes(cargo));if(!links.length)return null;
   const open=fold[section.id]??links.some(l=>active(l.href));
   return <section key={section.id} className="nova-nav-section"><button type="button" onClick={()=>setFold(x=>({...x,[section.id]:!open}))} aria-expanded={open} className="nova-nav-section-title">{section.title}<ChevronDown size={14} className={open?'nova-chevron-open':''}/></button>
    {open&&<nav className="nova-nav-links">{links.map(l=>{const Icon=l.icon;return <Link href={l.href} onClick={onNavigate} key={l.href} aria-current={active(l.href)?'page':undefined} className={'nova-nav-link'+(active(l.href)?' is-active':'')}><Icon size={18} strokeWidth={active(l.href)?2.15:1.8}/><span>{l.label}</span></Link>})}</nav>}
   </section>})}</div>
  <div className="nova-sidebar-footer"><Link href="/configuracoes" onClick={onNavigate}><CircleHelp size={16}/>Ajuda e suporte</Link><Link href="/minha-conta" onClick={onNavigate} className="nova-current-user"><span className="nova-user-avatar">{String(user?.nome||user?.login||'?')[0].toUpperCase()}</span><span><strong>{user?.nome||user?.login||'Minha conta'}</strong><small>{cargo}{user?.loja?` · Loja ${user.loja}`:''}</small></span></Link><button onClick={()=>void logout()}><LogOut size={16}/>Sair</button></div>
 </aside>;
}
