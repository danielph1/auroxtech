'use client';

import {useEffect,useMemo,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,ArrowRight,Check,CheckCircle2,Eye,EyeOff,LockKeyhole,Moon,ShieldCheck,Sun,
  Building2,CarFront,MessageSquareText,UsersRound,ChartNoAxesCombined,Layers3,
  Handshake,Wallet,ArrowUpRight,Globe2,Sparkles,ChevronDown,MousePointerClick,
} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '@/contexts/auth-context';
import {useTema} from '@/contexts/theme-context';
import {AuroxPulseLoader} from '@/components/aurox-pulse-loader';
import {AuroxSolicitarImplantacao} from '@/components/aurox-solicitar-implantacao';
import {AUROX_MODULOS_PUBLICOS,cotarAurox,reais,alternarModuloAurox} from '@/lib/aurox-precos-publicos';
import './aurox-precos-login.css';

const modulosIcones:Record<string,typeof CarFront>={
 crm:MessageSquareText,financeiro:Wallet,fiscal:Wallet,anuncios:Globe2,whatsapp:MessageSquareText,
 oficina:CarFront,inteligencia:ChartNoAxesCombined,parceiros:Handshake,site:Globe2,
};
const recursos=[
 {icon:MessageSquareText,titulo:'Leads do início ao fechamento',texto:'Triagem, conversas, tarefas e follow-up organizados para a equipe trabalhar com contexto.',status:'Disponível no CRM'},
 {icon:CarFront,titulo:'Estoque e operação',texto:'Veículos, preparação, documentação e informações comerciais em um só fluxo.',status:'Operação centralizada'},
 {icon:UsersRound,titulo:'Equipe e permissões',texto:'Cada profissional enxerga apenas o que seu papel e sua concessionária permitem.',status:'Separação por empresa'},
 {icon:ChartNoAxesCombined,titulo:'Visão comercial',texto:'Acompanhe oportunidades, resultados e gargalos. Indicadores avançados seguem em evolução.',status:'Métricas em evolução'},
];
export default function LoginPage(){
 const {login,isAuthenticated}=useAuth();const {tema,setTema}=useTema();
 const claro=tema==='claro'||tema==='cristal';const router=useRouter();
 const [tela,setTela]=useState<'site'|'entrar'>('site');
 const [solicitar,setSolicitar]=useState(false);
 const [loading,setLoading]=useState(false);const [mostrar,setMostrar]=useState(false);
 const [form,setForm]=useState({login:'',senha:''});
 const [modulos,setModulos]=useState<string[]>(['crm','financeiro']);
 const cotacao=useMemo(()=>cotarAurox(modulos),[modulos]);
 useEffect(()=>{if(isAuthenticated)router.replace('/inicio')},[isAuthenticated,router]);
 const alternar=(id:string)=>setModulos(p=>alternarModuloAurox(p,id));
 const navegar=(id:string)=>{setTela('site');requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'start'}))};
 async function entrar(e:FormEvent){
  e.preventDefault();if(!form.login.trim()||!form.senha){toast.error('Informe seu login e senha.');return;}
  setLoading(true);
  try{await login({login:form.login.trim(),senha:form.senha});router.replace('/inicio');}
  catch(err:any){toast.error(err?.response?.data?.error||'Não foi possível acessar. Confira seus dados.');}
  finally{setLoading(false);}
 }
 return <main className={`ax-market ${claro?'ax-market-light':'ax-market-dark'}`}>
  <header className="ax-market-header">
   <Link className="ax-market-brand" href="/login" onClick={e=>{if(tela==='entrar'){e.preventDefault();setTela('site')}}} aria-label="AUROX, página inicial"><img src="/aurox-logo.png" alt="" width="38" height="38"/><span>AUROX <small>GESTÃO AUTOMOTIVA</small></span></Link>
   <nav className="ax-market-nav" aria-label="Navegação da apresentação">
    <button type="button" onClick={()=>navegar('ax-recursos')}>Plataforma</button>
    <button type="button" onClick={()=>navegar('ax-planos')}>Planos</button>
   </nav>
   <div className="ax-market-actions">
    <button type="button" className="ax-market-theme" onClick={()=>setTema(claro?'escuro':'claro')} aria-label={claro?'Ativar tema escuro':'Ativar tema claro'}>{claro?<Moon size={17}/>:<Sun size={17}/>}</button>
    <button type="button" className="ax-market-loginbtn" onClick={()=>setTela(v=>v==='entrar'?'site':'entrar')}>{tela==='entrar'?<><ArrowLeft size={16}/> Ver apresentação</>:<><LockKeyhole size={16}/> Entrar no AUROX</>}</button>
   </div>
  </header>
  {tela==='entrar' ? <section className="ax-market-auth" aria-label="Acessar minha conta">
   <span className="ax-market-kicker"><ShieldCheck size={15}/> ACESSO À PLATAFORMA</span>
   <div className="ax-market-slogan ax-market-slogan-auth"><strong>AUROX</strong><span>Faça seu melhor com a melhor tecnologia.</span></div>
   <h1>Bem-vindo de volta.</h1><p>Acesse sua operação com segurança.</p>
   <form onSubmit={entrar} className="ax-market-auth-form">
    <label htmlFor="ax-user">Usuário</label><input id="ax-user" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.login} placeholder="Seu login" onChange={e=>setForm(p=>({...p,login:e.target.value}))}/>
    <label htmlFor="ax-password">Senha</label><div className="ax-market-password"><input id="ax-password" type={mostrar?'text':'password'} autoComplete="current-password" required value={form.senha} placeholder="Sua senha" onChange={e=>setForm(p=>({...p,senha:e.target.value}))}/><button type="button" onClick={()=>setMostrar(v=>!v)} aria-label={mostrar?'Ocultar senha':'Mostrar senha'}>{mostrar?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>
    <button disabled={loading} type="submit" className="ax-market-primary">{loading?<><AuroxPulseLoader inline/> Autenticando…</>:<>Acessar AUROX <ArrowRight size={18}/></>}</button>
   </form>
   <div className="ax-market-auth-bottom"><CheckCircle2 size={15}/> Ambiente exclusivo para usuários autorizados</div>
   <button className="ax-market-link-button" type="button" onClick={()=>setTela('site')}>Conhecer a plataforma e os valores</button>
  </section> : <>
   <section className="ax-market-hero" aria-label="Conheça a AUROX">
    <div className="ax-market-hero-copy">
     <span className="ax-market-kicker"><span className="ax-market-kicker-line"/> SUA REVENDA, MAIS INTELIGENTE</span>
     <h1 className="ax-market-slogan"><strong>AUROX</strong><span>Faça seu melhor com a melhor tecnologia.</span></h1>
     <p>Do primeiro contato à venda. O AUROX reúne estoque, atendimento, equipe e gestão em um único ambiente — pensado para quem vive o dia a dia da concessionária.</p>
     <div className="ax-market-hero-actions"><button type="button" className="ax-market-primary" onClick={()=>navegar('ax-recursos')}>Descobrir o AUROX <ArrowRight size={18}/></button><button type="button" className="ax-market-outline" onClick={()=>navegar('ax-planos')}>Ver planos e valores</button></div>
     <div className="ax-market-hero-proof"><span><ShieldCheck size={16}/> Dados separados por empresa</span><span><Layers3 size={16}/> Módulos sob medida</span></div>
    </div>
    <div className="ax-market-hero-visual" aria-label="Ilustração conceitual do painel AUROX">
     <div className="ax-market-window"><div className="ax-market-window-bar"><span className="ax-market-dot-cluster"><i/><i/><i/></span><span>AUROX / Visão operacional</span><span className="ax-market-window-mark">VISÃO ILUSTRATIVA</span></div>
      <div className="ax-market-window-inside">
       <div className="ax-market-window-side"><img src="/aurox-logo.png" alt="" width="27" height="27"/><span/><span/><span/><span/></div>
       <div className="ax-market-window-work"><div className="ax-market-window-welcome"><div><small>GESTÃO EM UM SÓ LUGAR</small><strong>Seu dia, em movimento.</strong></div><span className="ax-market-window-today">Painel</span></div>
        <div className="ax-market-window-mini-grid"><div><MessageSquareText size={18}/><span>Leads</span><b>Triagem organizada</b></div><div><CarFront size={18}/><span>Estoque</span><b>Veículos em foco</b></div><div><UsersRound size={18}/><span>Equipe</span><b>Fluxo integrado</b></div></div>
        <div className="ax-market-window-bottom"><div><small>JORNADA DO ATENDIMENTO</small><div className="ax-market-flow-stage"><span>Chegada</span><ArrowRight size={13}/><span>Negociação</span><ArrowRight size={13}/><span>Venda</span></div><div className="ax-market-skeleton-line"/><div className="ax-market-skeleton-line short"/></div><div className="ax-market-window-preview"><ChartNoAxesCombined size={30}/><strong>Decisões com contexto</strong><small>Uma visão mais clara da sua operação.</small></div></div>
       </div>
      </div></div>
     <div className="ax-market-window-sticker"><Sparkles size={17}/> Uma operação, mais possibilidades</div>
    </div>
    <button type="button" className="ax-market-scroll" onClick={()=>navegar('ax-recursos')}>Explore a plataforma <ChevronDown size={17}/></button>
   </section>
   <section className="ax-market-features" id="ax-recursos" aria-label="O que o AUROX oferece">
    <div className="ax-market-section-heading"><span className="ax-market-kicker">PENSADO PARA REVENDAS</span><h2>Menos telas soltas.<br/><em>Mais controle.</em></h2><p>Uma operação automotiva precisa de velocidade, organização e informação no lugar certo.</p></div>
    <div className="ax-market-feature-grid">{recursos.map(r=>{const Icon=r.icon;return <article className="ax-market-feature-card" key={r.titulo}><span className="ax-market-feature-icon"><Icon size={21}/></span><h3>{r.titulo}</h3><p>{r.texto}</p><small><Check size={13}/>{r.status}</small></article>})}</div>
    <div className="ax-market-feature-ribbon"><div><Building2 size={20}/><span><strong>Por empresa</strong><small>Informação no seu próprio ambiente</small></span></div><div><ShieldCheck size={20}/><span><strong>Por permissão</strong><small>Acesso de acordo com o cargo</small></span></div><div><MousePointerClick size={20}/><span><strong>Por necessidade</strong><small>Escolha os módulos para sua operação</small></span></div></div>
   </section>
   <section className="ax-market-plans" id="ax-planos" aria-label="Preços AUROX">
    <div className="ax-market-section-heading ax-market-plan-heading"><span className="ax-market-kicker">INVESTIMENTO SEM SURPRESAS</span><h2>Seu AUROX. <em>Seu pacote.</em></h2><p>Comece com o essencial e selecione os serviços de que precisa. Valores estimados, transparentes, sem consulta ao banco de dados.</p></div>
    <div className="ax-market-pricing-layout">
     <div className="ax-market-pricing-products">
      <div className="ax-market-base"><span><span className="ax-market-base-label">INCLUSO EM TODOS OS PLANOS</span><b>AUROX Base</b><small>Estoque, cadastro de veículos e equipe</small></span><strong>{reais(14900)}<small>/mês</small></strong></div>
      <div className="ax-market-products-label"><span>Módulos adicionais</span><small>Selecione para simular</small></div>
      <div className="ax-market-list" role="group" aria-label="Módulos adicionais">
       {AUROX_MODULOS_PUBLICOS.map(m=>{const Icon=modulosIcones[m.id]||Layers3;return <label key={m.id} className={`ax-market-option ${modulos.includes(m.id)?'is-selected':''}`}>
        <input type="checkbox" checked={modulos.includes(m.id)} onChange={()=>alternar(m.id)}/><span className="ax-market-check" aria-hidden="true">{modulos.includes(m.id)?<Check size={13}/>:<Icon size={16}/>}</span>
        <span className="ax-market-option-copy"><strong>{m.nome}</strong><small>{m.descricao}</small></span>
        <span className="ax-market-option-price">+ {reais(m.centavos)}</span>
       </label>})}
      </div>
      <p className="ax-market-pricing-hint">A equipe confirma a disponibilidade e a ativação de cada módulo antes da contratação. A oferta de WhatsApp contempla apenas uma conexão por empresa.</p>
     </div>
     <aside className="ax-market-summary" aria-label="Resumo da simulação">
      <span className="ax-market-kicker">SEU INVESTIMENTO</span><h3>Resumo do pacote</h3>
      <div className="ax-market-summary-sub"><span>Base</span><span>{reais(14900)}</span></div><div className="ax-market-summary-sub"><span>Módulos selecionados</span><span>{modulos.length}</span></div>
      <div className="ax-market-summary-total"><small>Mensalidade regular</small><strong>{reais(cotacao.normalCentavos)}<span>/mês</span></strong></div>
      {cotacao.elegivelPromocao?<div className="ax-market-offer"><strong><Sparkles size={16}/> Boas-vindas AUROX</strong><span>25% OFF no 1º mês • limite de R$ 180</span><div><small>Primeiro mês</small><b>{reais(cotacao.primeiroMesCentavos)}</b></div><p>Você economiza {reais(cotacao.economiaCentavos)}. Depois, {reais(cotacao.normalCentavos)}/mês.</p></div>
       :<div className="ax-market-offer ax-market-offer-muted"><strong>Condição de boas-vindas</strong><p>Pacotes acima de R$ 500 têm 25% de desconto na primeira mensalidade, até R$ 180.</p></div>}
      <button type="button" className="ax-market-primary" onClick={()=>setSolicitar(true)}>Solicitar implantação <ArrowUpRight size={18}/></button>
      <p className="ax-market-note">Esta é uma simulação, não uma contratação. A equipe confirma módulos, disponibilidade, condições e possíveis custos externos.</p>
     </aside>
    </div>
   </section>
   <section className="ax-market-closing"><div><span className="ax-market-kicker">AUROX · GESTÃO AUTOMOTIVA</span><h2>Seu próximo lead merece<br/>uma operação preparada.</h2><p>Conte sobre sua concessionária. Nossa equipe entra em contato para entender o que faz sentido para você.</p></div><button type="button" className="ax-market-primary" onClick={()=>setSolicitar(true)}>Quero conhecer o AUROX <ArrowRight size={18}/></button></section>
  </>}
  <AuroxSolicitarImplantacao open={solicitar} onClose={()=>setSolicitar(false)} modulos={modulos}/>
  <footer className="ax-market-footer"><span>© AUROX · Gestão automotiva</span><nav aria-label="Links legais"><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/ajuda">Ajuda e suporte</Link></nav></footer>
 </main>;
}
