'use client';
import Link from 'next/link';
import {useAuth} from '@/contexts/auth-context';
import {Bell,CalendarDays,ChevronRight,CircleHelp,FileClock,FileText,Heart,Info,LogOut,Palette,ShieldCheck,UserRound,Wallet,Workflow} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

type Item = {href:string;label:string;info:string;icon:LucideIcon;roles?:string[]};
const pessoal:Item[]=[
 {href:'/minha-conta',label:'Minha conta',info:'Nome, telefone, e-mail, foto e acesso',icon:UserRound},
 {href:'/favoritos',label:'Favoritos',info:'Seus leads e registros destacados',icon:Heart},
 {href:'/agenda',label:'Agenda',info:'Visitas, retornos e compromissos',icon:CalendarDays},
];
const preferencias:Item[]=[
 {href:'/temas',label:'Aparência',info:'Tema claro, escuro e opções liberadas',icon:Palette},
 {href:'/configuracoes/notificacoes',label:'Notificações e sons',info:'Escolha os avisos, dispositivos inscritos e faça um teste',icon:Bell},
];
const operacao:Item[]=[
 {href:'/integracoes',label:'Integrações',info:'Conexões de mensagens e classificados',icon:Workflow,roles:['superadmin','admin','marketing']},
 {href:'/financas',label:'Contas e vencimentos',info:'Controle de recebimentos e despesas',icon:Wallet,roles:['superadmin','admin']},
 {href:'/historico',label:'Histórico e auditoria',info:'Alterações e movimentações autorizadas',icon:FileClock,roles:['superadmin','admin','gerente','marketing']},
];
const institucional:Item[]=[
 {href:'/sobre',label:'Sobre a Aurox',info:'Propósito e responsabilidades da plataforma',icon:Info},
 {href:'/privacidade',label:'Política de Privacidade',info:'Tratamento de dados, proteção e direitos',icon:ShieldCheck},
 {href:'/termos',label:'Termos de Uso',info:'Condições e uso responsável do sistema',icon:FileText},
 {href:'/ajuda',label:'Ajuda e suporte',info:'Orientações e abertura de chamados',icon:CircleHelp},
];
function Grupo({titulo,itens,role}:{titulo:string;itens:Item[];role:string}){
 const disponiveis=itens.filter(x=>!x.roles||x.roles.includes(role));
 if(!disponiveis.length)return null;
 return <section className="settings-v3-group"><h2>{titulo}</h2><div className="settings-v3-links">{disponiveis.map(({href,icon:Icon,label,info})=><Link key={href} href={href} className="settings-v3-link"><span className="settings-v3-link-icon"><Icon size={19}/></span><span className="settings-v3-link-info"><strong>{label}</strong><small>{info}</small></span><ChevronRight size={17} className="settings-v3-chevron"/></Link>)}</div></section>;
}
export default function ConfiguracoesPage(){
 const {user,logout}=useAuth();const role=String(user?.tipo||'').toLowerCase();
 return <div className="settings-v3-page"><header className="settings-v3-heading"><span className="studio-eyebrow">Preferências e conta</span><h1>Configurações</h1><p>As ferramentas essenciais para ajustar sua experiência e proteger o acesso.</p></header>
 <div className="settings-v3-columns"><main><Grupo titulo="Minha área" itens={pessoal} role={role}/><Grupo titulo="Preferências" itens={preferencias} role={role}/><Grupo titulo="Administração e operação" itens={operacao} role={role}/></main><aside><Grupo titulo="Informações e suporte" itens={institucional} role={role}/><section className="settings-v3-signout"><div><strong>Encerrar sessão</strong><p>Ao sair, será necessário entrar novamente com suas credenciais.</p></div><button type="button" onClick={()=>void logout()} className="settings-v3-logout"><LogOut size={17}/>Sair da minha conta</button></section></aside></div></div>;
}
