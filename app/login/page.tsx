'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,CarFront,ChartNoAxesCombined,ChevronDown,Eye,EyeOff,LockKeyhole,Moon,ShieldCheck,Sun,UsersRound} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '@/contexts/auth-context';
import {useTema} from '@/contexts/theme-context';
import {AuroxPulseLoader} from '@/components/aurox-pulse-loader';
import {AuroxLoginShowcase} from '@/components/aurox-login-showcase';
import './login-aurox.css';
import './login-refino-v2.css';

/** A coluna de apresentação rola sozinha no desktop; o login continua acessível. */
export default function LoginPage(){
 const {login,isAuthenticated}=useAuth();
 const {tema,setTema}=useTema();
 const claro=tema==='claro'||tema==='cristal';
 const router=useRouter();
 const [loading,setLoading]=useState(false);
 const [mostrar,setMostrar]=useState(false);
 const [form,setForm]=useState({login:'',senha:''});
 useEffect(()=>{if(isAuthenticated)router.replace('/inicio');},[isAuthenticated,router]);
 async function entrar(e:FormEvent){
  e.preventDefault();
  if(!form.login.trim()||!form.senha){toast.error('Informe seu login e senha.');return;}
  setLoading(true);
  try{await login({login:form.login.trim(),senha:form.senha});router.replace('/inicio');}
  catch(err:any){toast.error(err?.response?.data?.error||'Não foi possível acessar. Confira seus dados.');}
  finally{setLoading(false);}
 }
 return <main className={'aurox-login-root aurox-login-v2'+(claro?' is-light':' is-dark')}>
  <div className="aurox-login-layout">
   <section className="aurox-login-story" aria-label="Conheça a Aurox Gestão Automotiva">
    <div className="aurox-story-inner">
     <div className="aurox-story-first">
      <div className="aurox-story-brand">
       <span className="aurox-story-brand-logo"><img src="/aurox-logo.png" alt="Símbolo Aurox"/></span>
       <span className="aurox-brand-words"><span className="aurox-story-brand-name">Aurox</span><span className="aurox-story-brand-sub">Gestão automotiva</span></span>
      </div>
      <div className="aurox-story-hero">
       <span className="aurox-story-label"><span className="aurox-hero-marker"/> O seu dia a dia, em movimento</span>
       <h1>Do primeiro lead<br/>à entrega das <em>chaves.</em></h1>
       <p>Atendimento, veículos e operação comercial no mesmo lugar. Cada etapa com contexto, responsável e próximo passo.</p>
       <div className="aurox-story-pillar-row" aria-label="Áreas do Aurox">
        <div><UsersRound size={19} strokeWidth={1.6}/><span>Atendimento</span></div>
        <div><CarFront size={19} strokeWidth={1.6}/><span>Estoque</span></div>
        <div><ChartNoAxesCombined size={19} strokeWidth={1.6}/><span>Resultados</span></div>
       </div>
       <div className="aurox-journey-preview" aria-label="Etapas do trabalho conectadas">
        <div className="aurox-journey-heading"><span>FLUXO AUROX</span><small>Sem perder o histórico do cliente</small></div>
        <div className="aurox-journey-track">
         <span><b>01</b> Triagem</span><i aria-hidden="true"/>
         <span><b>02</b> Conversa</span><i aria-hidden="true"/>
         <span><b>03</b> Ficha</span><i aria-hidden="true"/>
         <span><b>04</b> Venda</span>
        </div>
       </div>
      </div>
      <div className="aurox-story-scroll-hint">Conheça o que conecta a operação <ChevronDown size={15}/></div>
     </div>
     <AuroxLoginShowcase/>
    </div>
   </section>
   <section className="aurox-login-panel" aria-label="Entrar na Aurox">
    <div className="aurox-login-toolbar">
     <span className="aurox-login-toolbar-label">Aurox <span aria-hidden="true">/</span> Acesso à plataforma</span>
     <button type="button" className="aurox-login-theme-switch" onClick={()=>setTema(claro?'escuro':'claro')}
      aria-label={claro?'Ativar tema escuro':'Ativar tema claro'} title={claro?'Ativar tema escuro':'Ativar tema claro'}>
      {claro?<Moon size={16}/>:<Sun size={16}/>}<span>{claro?'Escuro':'Claro'}</span>
     </button>
    </div>
    <div className="aurox-login-form-wrap">
     <span className="aurox-login-shield"><LockKeyhole size={19} strokeWidth={1.7}/></span>
     <div className="aurox-login-form-eyebrow">CONTINUE SUA OPERAÇÃO</div>
     <h2>Bem-vindo de volta.</h2>
     <p className="aurox-login-subtitle">Acesse seu ambiente de trabalho.</p>
     <form className="aurox-login-form" onSubmit={entrar}>
      <div className="aurox-login-field"><label htmlFor="login">Usuário</label><input id="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="Seu login"/></div>
      <div className="aurox-login-field"><label htmlFor="senha">Senha</label><div className="aurox-login-password"><input id="senha" type={mostrar?'text':'password'} autoComplete="current-password" required value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Sua senha"/><button type="button" aria-label={mostrar?'Ocultar senha':'Mostrar senha'} onClick={()=>setMostrar(x=>!x)}>{mostrar?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div>
      <button className="aurox-login-submit" disabled={loading} type="submit">{loading?<><AuroxPulseLoader inline/> Autenticando…</>:<>Acessar Aurox <ArrowRight size={17}/></>}</button>
     </form>
     <p className="aurox-login-access-note"><ShieldCheck size={14}/> Ambiente exclusivo para usuários autorizados</p>
     <nav className="aurox-login-legal" aria-label="Informações da plataforma"><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/ajuda">Ajuda e suporte</Link></nav>
    </div>
    <span className="aurox-login-panel-foot">AUROX · GESTÃO AUTOMOTIVA</span>
   </section>
  </div>
 </main>;
}
