'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {Bell,CalendarDays,ChevronRight,Menu,Moon,Plus,Search,Sun,UserRound,X} from 'lucide-react';
import {useAuth} from '@/contexts/auth-context';
import {useAuroxModulos} from '@/hooks/use-aurox-modulos';
import {useTema} from '@/contexts/theme-context';

const ROUTES=[
 {name:'Visão geral',url:'/inicio',role:[]},
 {name:'Agenda',url:'/agenda',role:[]},
 {name:'Leads',url:'/painel',role:['vendedor','marketing','gerente','admin','superadmin']},
 {name:'Triagem',url:'/triagem',role:['gerente','marketing','admin','superadmin']},
 {name:'Conversas',url:'/chat',role:['vendedor','marketing','gerente','admin','superadmin']},
 {name:'Follow Up',url:'/follow-up',role:['vendedor','gerente','admin','superadmin']},
 {name:'Fichas',url:'/fichas',role:['vendedor','marketing','gerente','admin','superadmin','elfenai','elfen_ai','elfenaí']},
 {name:'Tarefas',url:'/tarefas',role:[]},
 {name:'Finanças',url:'/financas',role:['admin','superadmin']},
 {name:'Estoque',url:'/estoque',role:[]},
 {name:'Oficina',url:'/oficina',role:[]},
 {name:'Equipe',url:'/equipe',role:['gerente','admin','superadmin']},
 {name:'Métricas',url:'/metricas',role:['gerente','marketing','admin','superadmin']},
 {name:'Configurações',url:'/configuracoes',role:[]},
];
export const AUROX_TITLES:Record<string,string>={
 '/inicio':'Visão geral','/agenda':'Agenda e compromissos','/painel':'Painel de leads','/triagem':'Triagem','/chat':'Conversas',
 '/follow-up':'Follow Up','/fichas':'Fichas de crédito','/tarefas':'Tarefas','/metas':'Metas',
 '/metricas':'Métricas e resultados','/desempenho':'Desempenho da equipe','/ranking':'Ranking',
 '/estoque':'Estoque','/anuncios':'Anúncios','/anuncio-coletivo':'Anúncio coletivo',
 '/processos':'Transferências','/oficina':'Oficina','/faturamento':'Faturamento',
 '/financas':'Finanças','/equipe':'Equipe','/gestao-usuarios':'Usuários e cadastros',
 '/historico':'Histórico e auditoria','/integracoes':'Integrações','/configuracoes':'Configurações',
 '/minha-conta':'Meu perfil','/novo-lead':'Cadastrar lead'
};
export function AuroxTopbar({onMenu}:{onMenu:()=>void}){
 const path=usePathname()||'/inicio';const router=useRouter();const {user}=useAuth();const {tema,setTema}=useTema();const {pode:acessoModulo}=useAuroxModulos();
 const [busca,setBusca]=useState(''),[aberto,setAberto]=useState(false);const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const handler=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();inputRef.current?.focus();setAberto(true);}};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);},[]);
 const cargo=String(user?.tipo||'').toLowerCase();const claro=tema==='claro';
 const links=useMemo(()=>ROUTES.filter(r=>(!r.role.length||r.role.includes(cargo))&&acessoModulo(r.url)).filter(r=>r.name.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).slice(0,8),[cargo,busca,acessoModulo]);
 const title=Object.entries(AUROX_TITLES).find(([href])=>href===path)?.[1]||Object.entries(AUROX_TITLES).find(([href])=>path.startsWith(href+'/'))?.[1]||'Área de trabalho';
 return <header className="nova-topbar">
  <div className="nova-topbar-main">
   <button type="button" className="nova-icon-button nova-menu-trigger" onClick={onMenu} aria-label="Abrir menu"><Menu size={21}/></button>
   <div className="nova-page-title"><span className="nova-breadcrumb">Espaço de trabalho <ChevronRight size={12}/> AUROX</span><strong>{title}</strong></div>
   <div className="nova-global-search">
    <Search size={17}/><input ref={inputRef} aria-label="Pesquisar páginas do sistema" placeholder="Pesquisar páginas (Ctrl+K)" value={busca}
     onFocus={()=>setAberto(true)} onChange={e=>{setBusca(e.target.value);setAberto(true)}}
     onKeyDown={e=>{if(e.key==='Escape')setAberto(false);if(e.key==='Enter'&&links[0]){router.push(links[0].url);setAberto(false);setBusca('');}}}/>
    {aberto&&busca&&<div className="nova-search-results" role="listbox">{links.length?links.map(item=><Link key={item.url} href={item.url} onClick={()=>{setAberto(false);setBusca('')}}>{item.name}<ChevronRight size={14}/></Link>):<p>Nenhuma página encontrada.</p>}</div>}
   </div>
   <div className="nova-topbar-actions">
    {acessoModulo("/agenda")&&<Link href="/agenda" className="nova-icon-button" title="Agenda"><CalendarDays size={18}/></Link>}
    <button type="button" onClick={()=>setTema(claro?'escuro':'claro')} className="nova-icon-button" aria-label={claro?'Ativar tema escuro':'Ativar tema claro'} title={claro?'Tema escuro':'Tema claro'}>{claro?<Moon size={18}/>:<Sun size={18}/>}</button>
    <Link href="/configuracoes/notificacoes" className="nova-icon-button" title="Configurar notificações"><Bell size={18}/></Link>
    {['vendedor','gerente','admin','superadmin','marketing'].includes(cargo)&&acessoModulo('/novo-lead')&&<Link href="/novo-lead" className="nova-primary-action"><Plus size={16}/><span>Novo lead</span></Link>}
    <Link href="/configuracoes" className="nova-topbar-user" title="Configurações"><span>{String(user?.nome||user?.login||'?')[0]?.toUpperCase()}</span><strong>{String(user?.nome||user?.login||'Perfil').split(' ')[0]}</strong></Link>
   </div>
  </div>
 </header>;
}
