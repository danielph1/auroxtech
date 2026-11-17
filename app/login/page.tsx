'use client';

import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,Check,CheckCircle2,Eye,EyeOff,LockKeyhole,Moon,ShieldCheck,Sun,ChevronDown} from 'lucide-react';
import {toast} from 'sonner';
import {useAuth} from '@/contexts/auth-context';
import {useTema} from '@/contexts/theme-context';
import {AuroxPulseLoader} from '@/components/aurox-pulse-loader';
import {AuroxSolicitarImplantacao} from '@/components/aurox-solicitar-implantacao';
import {
  AUROX_MODULOS_PUBLICOS, AUROX_NUMEROS_MAX_SIMULADOR,
  AUROX_WHATSAPP_NUMERO_EXTRA_CENTAVOS,cotarAurox,reais,
} from '@/lib/aurox-precos-publicos';
import './aurox-precos-login.css';

function dataHoje():string{
 const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
/** Apenas uma simulação de prazo; contratos reais serão registrados no backend. */
function diasPromocionais(inicio:string):number{
 const m=/^(\d{4})-(\d\d)-(\d\d)$/.exec(inicio);if(!m)return 0;
 const y=Number(m[1]),mes=Number(m[2]),d=Number(m[3]);
 const start=new Date(y,mes-1,d);if(start.getFullYear()!==y||start.getMonth()!==mes-1||start.getDate()!==d)return 0;
 const ultimoDiaMesSeguinte=new Date(y,mes+1,0).getDate();
 const end=new Date(y,mes,Math.min(d,ultimoDiaMesSeguinte));const hoje=new Date();hoje.setHours(0,0,0,0);
 if(hoje<start)return Math.max(0,Math.ceil((end.getTime()-start.getTime())/86400000));
 return Math.max(0,Math.ceil((end.getTime()-hoje.getTime())/86400000));
}
export default function LoginPage(){
 const {login,isAuthenticated}=useAuth();const {tema,setTema}=useTema();
 const claro=tema==='claro'||tema==='cristal';const router=useRouter();
 const [tela,setTela]=useState<'precos'|'entrar'>('precos');
 const [solicitar,setSolicitar]=useState(false);
 const [loading,setLoading]=useState(false);const [mostrar,setMostrar]=useState(false);
 const [form,setForm]=useState({login:'',senha:''});
 const [modulos,setModulos]=useState<string[]>(['crm','financeiro']);
 const [numerosWhatsApp,setNumerosWhatsApp]=useState(1);
 const [inicioSimulado,setInicioSimulado]=useState(dataHoje);
 const cotacao=useMemo(()=>cotarAurox(modulos,numerosWhatsApp),[modulos,numerosWhatsApp]);
 const diasRestantes=diasPromocionais(inicioSimulado);
 useEffect(()=>{if(isAuthenticated)router.replace('/inicio');},[isAuthenticated,router]);
 const alternar=(id:string)=>setModulos(p=>p.includes(id)?p.filter(v=>v!==id):[...p,id]);
 async function entrar(e:FormEvent){
  e.preventDefault();if(!form.login.trim()||!form.senha){toast.error('Informe seu login e senha.');return;}
  setLoading(true);
  try{await login({login:form.login.trim(),senha:form.senha});router.replace('/inicio');}
  catch(err:any){toast.error(err?.response?.data?.error||'Não foi possível acessar. Confira seus dados.');}
  finally{setLoading(false);}
 }
 return <main className={`ax-market ${claro?'ax-market-light':'ax-market-dark'}`}>
  <header className="ax-market-header">
    <Link className="ax-market-brand" href="/login" aria-label="AUROX, início"><img src="/aurox-logo.png" alt="" width="34" height="34"/><span>AUROX <small>GESTÃO AUTOMOTIVA</small></span></Link>
    <div className="ax-market-actions">
      <button type="button" className="ax-market-theme" onClick={()=>setTema(claro?'escuro':'claro')} aria-label={claro?'Ativar tema escuro':'Ativar tema claro'}>{claro?<Moon size={17}/>:<Sun size={17}/>}</button>
      <button type="button" className="ax-market-loginbtn" onClick={()=>setTela(v=>v==='entrar'?'precos':'entrar')}>
       {tela==='entrar'?<><ArrowLeft size={17}/> Ver planos</>:<><LockKeyhole size={16}/> Entrar no AUROX</>}
      </button>
    </div>
  </header>
  {tela==='entrar' ? <section className="ax-market-auth" aria-label="Acessar minha conta">
   <span className="ax-market-kicker"><ShieldCheck size={15}/> ACESSO RESTRITO</span>
   <h1>Bem-vindo de volta.</h1><p>Entre na sua conta para continuar sua operação.</p>
   <form onSubmit={entrar} className="ax-market-auth-form">
    <label htmlFor="ax-user">Usuário</label><input id="ax-user" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={form.login} placeholder="Seu login" onChange={e=>setForm(p=>({...p,login:e.target.value}))}/>
    <label htmlFor="ax-password">Senha</label><div className="ax-market-password"><input id="ax-password" type={mostrar?'text':'password'} autoComplete="current-password" required value={form.senha} placeholder="Sua senha" onChange={e=>setForm(p=>({...p,senha:e.target.value}))}/><button type="button" onClick={()=>setMostrar(v=>!v)} aria-label={mostrar?'Ocultar senha':'Mostrar senha'}>{mostrar?<EyeOff size={19}/>:<Eye size={19}/>}</button></div>
    <button disabled={loading} type="submit" className="ax-market-primary">{loading?<><AuroxPulseLoader inline/> Autenticando…</>:<>Acessar AUROX <ArrowRight size={18}/></>}</button>
   </form>
   <div className="ax-market-auth-bottom"><CheckCircle2 size={15}/> Ambiente exclusivo para usuários autorizados</div>
   <button className="ax-market-link-button" type="button" onClick={()=>setTela('precos')}>Conhecer planos e serviços</button>
  </section> : <section className="ax-market-content" aria-label="Simulador comercial AUROX">
    <div className="ax-market-intro">
      <span className="ax-market-kicker">TECNOLOGIA PARA QUEM VENDE VEÍCULOS</span>
      <h1>Mais vendas.<br/><em>Menos complicação.</em></h1>
      <p>Escolha os módulos que fazem sentido para a sua concessionária. Veja os valores antes de contratar, sem cadastro e sem compromisso.</p>
      <div className="ax-market-points"><span><Check size={15}/> Estoque e equipe</span><span><Check size={15}/> Módulos independentes</span><span><Check size={15}/> Preço transparente</span></div>
      <div className="ax-market-promo-info"><strong>Condição de boas-vindas</strong><p>Mensalidades <b>acima de R$ 500</b> recebem <b>25% de desconto no primeiro mês, limitado a R$ 180</b>. A partir do segundo mês, vale o preço integral contratado.</p></div>
    </div>
    <div className="ax-market-calculator">
     <div className="ax-market-calc-head"><div><span className="ax-market-kicker">MONTE SEU PACOTE</span><h2>Simule sua assinatura</h2></div><span className="ax-market-calc-pill">Mensal</span></div>
     <div className="ax-market-base"><span><b>AUROX Base</b><small>Estoque, cadastro de veículos e equipe</small></span><strong>{reais(14900)}</strong></div>
     <div className="ax-market-list" role="group" aria-label="Módulos adicionais">
       {AUROX_MODULOS_PUBLICOS.map(m=><label key={m.id} className={`ax-market-option ${modulos.includes(m.id)?'is-selected':''}`}>
        <input type="checkbox" checked={modulos.includes(m.id)} onChange={()=>alternar(m.id)}/><span className="ax-market-check" aria-hidden="true">{modulos.includes(m.id)&&<Check size={13}/>}</span>
        <span className="ax-market-option-copy"><strong>{m.nome}{m.estado!=='disponivel'&&<small className="ax-market-preview-tag">{m.estado==='previsto'?'Em breve':'Em implantação'}</small>}</strong><small>{m.descricao}</small></span>
        <span className="ax-market-option-price">+ {reais(m.centavos)}</span>
       </label>)}
     </div>
     {modulos.includes('whatsapp')&&<div className="ax-market-numbers"><label htmlFor="ax-wa-numbers">Números de WhatsApp (simulação)</label><select id="ax-wa-numbers" value={numerosWhatsApp} onChange={e=>setNumerosWhatsApp(Number(e.target.value))}>{Array.from({length:AUROX_NUMEROS_MAX_SIMULADOR},(_,i)=><option key={i+1} value={i+1}>{i+1} {i===0?'número':'números'}</option>)}</select><small>Inclui 1 número. Cada adicional: {reais(AUROX_WHATSAPP_NUMERO_EXTRA_CENTAVOS)}/mês. Capacidade técnica de 30 sessões ainda depende de homologação.</small></div>}
     <div className="ax-market-summary">
      <div className="ax-market-summary-row"><span>Mensalidade regular</span><strong>{reais(cotacao.normalCentavos)}</strong></div>
      {cotacao.elegivelPromocao ? <div className="ax-market-offer"><div><strong>Você ganhou 25% de desconto!</strong><span>Só no primeiro mês · economia até R$ 180</span></div><div><small>Primeira mensalidade</small><strong>{reais(cotacao.primeiroMesCentavos)}</strong></div><p>Economia inicial: {reais(cotacao.economiaCentavos)}. Depois: {reais(cotacao.normalCentavos)}/mês.</p></div>
      : <p className="ax-market-tip">A promoção é válida para mensalidades <strong>acima</strong> de R$ 500. Total de R$ 500 não se qualifica.</p>}
      <details className="ax-market-countdown"><summary>Como funciona o prazo de 1 mês <ChevronDown size={15}/></summary><div><p>O prazo começa na data real de ativação do contrato. Abaixo é apenas uma simulação; <b>nenhum contrato é criado aqui</b>.</p><label htmlFor="ax-date">Simular início da contratação</label><input id="ax-date" type="date" value={inicioSimulado} onChange={e=>setInicioSimulado(e.target.value)}/><strong>{diasRestantes} dia(s) de promoção no exemplo</strong></div></details>
      <button type="button" className="ax-market-primary" onClick={()=>setSolicitar(true)}>Solicitar implantação <ArrowRight size={18}/></button>
      <button type="button" className="ax-market-secondary" onClick={()=>setTela('entrar')}>Já sou cliente · Entrar no AUROX</button>
      <p className="ax-market-note">Valores de referência comercial. Sem cobrança nesta tela. Serviços em implantação dependem de liberação técnica, e domínio próprio é contratado à parte.</p>
     </div>
    </div>
  </section>}
  <AuroxSolicitarImplantacao open={solicitar} onClose={()=>setSolicitar(false)} modulos={modulos} numerosWhatsApp={numerosWhatsApp}/>
  <footer className="ax-market-footer"><span>© AUROX · Gestão automotiva</span><nav aria-label="Links legais"><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/ajuda">Suporte</Link></nav></footer>
 </main>;
}
