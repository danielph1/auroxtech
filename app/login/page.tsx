'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LockKeyhole, Eye, EyeOff, ArrowRight, ShieldCheck, CarFront, UsersRound, ChartNoAxesCombined, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { AuroxPulseLoader } from '@/components/aurox-pulse-loader';
import { AuroxLoginShowcase } from '@/components/aurox-login-showcase';
import './login-aurox.css';

export default function LoginPage() {
 const { login, isAuthenticated } = useAuth();
 const router = useRouter();
 const [loading, setLoading] = useState(false);
 const [mostrar, setMostrar] = useState(false);
 const [form, setForm] = useState({login:'',senha:''});
 useEffect(() => { if (isAuthenticated) router.replace('/inicio'); }, [isAuthenticated,router]);
 async function entrar(e:FormEvent) {
  e.preventDefault();
  if (!form.login.trim() || !form.senha) {toast.error('Informe seu login e senha.');return;}
  setLoading(true);
  try {await login({login:form.login.trim(),senha:form.senha});router.replace('/inicio');}
  catch (err:any) {toast.error(err?.response?.data?.error||'Não foi possível acessar. Confira seus dados.');}
  finally {setLoading(false);}
 }
 return <main className="aurox-login-root">
  <div className="aurox-login-layout">
   <section className="aurox-login-story" aria-label="Apresentação da plataforma Aurox">
    <div className="aurox-story-inner">
     <div className="aurox-story-first">
      <div className="aurox-story-brand">
       <span className="aurox-story-brand-logo"><img src="/aurox-logo.png" alt="Marca Aurox"/></span>
       <span><span className="aurox-story-brand-name">Aurox</span><span className="aurox-story-brand-sub">Gestão automotiva</span></span>
      </div>
      <div className="aurox-story-hero">
       <span className="aurox-story-label">Uma operação mais clara</span>
       <h1>Tudo acontece<br/>em um só lugar<b>.</b></h1>
       <p>Do primeiro contato à entrega do veículo. Equipe, atendimento, estoque e resultados em um fluxo de trabalho que faz sentido.</p>
       <div className="aurox-story-pillar-row">
        <div><UsersRound size={20} strokeWidth={1.6}/>Atendimento</div>
        <div><CarFront size={20} strokeWidth={1.6}/>Estoque</div>
        <div><ChartNoAxesCombined size={20} strokeWidth={1.6}/>Resultados</div>
       </div>
      </div>
      <div className="aurox-story-scroll-hint" aria-hidden="true">Explore o Aurox <ChevronDown size={15}/></div>
     </div>
     <AuroxLoginShowcase/>
    </div>
   </section>
   <section className="aurox-login-panel" aria-label="Acessar conta">
    <div className="aurox-login-form-wrap">
     <span className="aurox-login-shield"><LockKeyhole size={20} strokeWidth={1.7}/></span>
     <h2>Bem-vindo de volta.</h2>
     <p className="aurox-login-subtitle">Entre para continuar de onde parou.</p>
     <form className="aurox-login-form" onSubmit={entrar}>
      <div className="aurox-login-field"><label htmlFor="login">Seu login</label><input id="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.login} onChange={e=>setForm({...form,login:e.target.value})} placeholder="Digite seu usuário"/></div>
      <div className="aurox-login-field"><label htmlFor="senha">Sua senha</label><div className="aurox-login-password"><input id="senha" type={mostrar?'text':'password'} autoComplete="current-password" required value={form.senha} onChange={e=>setForm({...form,senha:e.target.value})} placeholder="Digite sua senha"/><button type="button" aria-label={mostrar?'Ocultar senha':'Mostrar senha'} onClick={()=>setMostrar(v=>!v)}>{mostrar?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></div>
      <button className="aurox-login-submit" disabled={loading} type="submit">{loading?<><AuroxPulseLoader inline/> Autenticando…</>:<>Acessar Aurox <ArrowRight size={17}/></>}</button>
     </form>
     <p className="aurox-login-access-note"><ShieldCheck size={15}/>Acesso exclusivo para usuários autorizados.</p>
     <nav className="aurox-login-legal" aria-label="Informações da plataforma"><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/ajuda">Ajuda e suporte</Link></nav>
    </div>
   </section>
  </div>
 </main>;
}
