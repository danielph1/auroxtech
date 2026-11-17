'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,CheckCircle2,Phone,ShieldCheck,X} from 'lucide-react';
import {reais,cotarAurox} from '@/lib/aurox-precos-publicos';

type Props={open:boolean;onClose:()=>void;modulos:string[]};
const estados=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export function AuroxSolicitarImplantacao({open,onClose,modulos}:Props){
 const [form,setForm]=useState({nome:'',empresa:'',telefone:'',cidade:'',uf:'',observacao:'',consentimento:false,site_empresa_url:''});
 const [busy,setBusy]=useState(false),[success,setSuccess]=useState(false),[error,setError]=useState('');
 const cotacao=cotarAurox(modulos);
 useEffect(()=>{if(!open)return;const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose()};document.addEventListener('keydown',esc);return()=>document.removeEventListener('keydown',esc)},[open,onClose,busy]);
 if(!open)return null;
 async function enviar(e:FormEvent){
  e.preventDefault();if(busy)return;
  const tel=form.telefone.replace(/\D/g,'');
  if(tel.length<10||tel.length>15){setError('Informe telefone com DDD (10 a 15 dígitos).');return;}
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/comercial/solicitar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,modulos}),cache:'no-store'});
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(String(data.error||'Não foi possível enviar.'));
   setSuccess(true);
  }catch(err){setError(err instanceof Error?err.message:'Falha de conexão. Tente novamente.');}
  finally{setBusy(false);}
 }
 const change=(key:keyof typeof form,value:string|boolean)=>setForm(p=>({...p,[key]:value}));
 return <div className="ax-market-overlay" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)onClose()}}>
  <section className="ax-market-dialog" role="dialog" aria-modal="true" aria-labelledby="ax-modal-title">
   <div className="ax-market-dialog-head"><div><span className="ax-market-kicker">AUROX · CONTRATAÇÃO</span><h2 id="ax-modal-title">{success?'Solicitação recebida':'Solicitar implantação'}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={20}/></button></div>
   {success?<div className="ax-market-dialog-success"><CheckCircle2 size={36}/><h3>Recebemos seu interesse.</h3><p>Nossa equipe comercial entrará em contato pelo telefone informado. Este pedido não cria conta nem gera cobrança.</p><button className="ax-market-primary" type="button" onClick={onClose}>Voltar aos planos</button></div>:
   <form className="ax-market-dialog-body" onSubmit={enviar}>
    <div className="ax-market-dialog-quote"><span>Pacote estimado</span><strong>{reais(cotacao.normalCentavos)}/mês</strong>{cotacao.elegivelPromocao&&<small>Primeiro mês: {reais(cotacao.primeiroMesCentavos)} (25% OFF, teto R$ 180)</small>}</div>
    <div className="ax-market-form-grid">
     <label>Nome do responsável *<input required minLength={3} maxLength={140} autoComplete="name" value={form.nome} onChange={e=>change('nome',e.target.value)} placeholder="Seu nome"/></label>
     <label>Concessionária *<input required minLength={2} maxLength={140} value={form.empresa} onChange={e=>change('empresa',e.target.value)} placeholder="Nome da empresa"/></label>
     <label>Telefone com DDD *<input required type="tel" inputMode="tel" maxLength={24} autoComplete="tel" value={form.telefone} onChange={e=>change('telefone',e.target.value)} placeholder="(21) 99999-9999"/></label>
     <label>Cidade *<input required minLength={2} maxLength={90} value={form.cidade} onChange={e=>change('cidade',e.target.value)} placeholder="Sua cidade"/></label>
     <label>Estado *<select required value={form.uf} onChange={e=>change('uf',e.target.value)}><option value="">Selecione</option>{estados.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
     <label className="ax-market-form-full">O que podemos preparar para você? <textarea rows={2} maxLength={450} value={form.observacao} onChange={e=>change('observacao',e.target.value)} placeholder="Conte sobre sua operação (opcional)"/></label>
    </div>
    <label className="ax-market-consent"><input type="checkbox" required checked={form.consentimento} onChange={e=>change('consentimento',e.target.checked)}/><span>Autorizo a AUROX a usar meus dados para retornar este pedido comercial, conforme a <a href="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</a>.</span></label>
    <div className="ax-market-honeypot" aria-hidden="true"><label>Site<input tabIndex={-1} autoComplete="off" value={form.site_empresa_url} onChange={e=>change('site_empresa_url',e.target.value)}/></label></div>
    {error&&<p role="alert" className="ax-market-form-error">{error}</p>}
    <button disabled={busy} className="ax-market-primary" type="submit">{busy?'Enviando…':<><Phone size={17}/> Quero falar com a AUROX <ArrowRight size={17}/></>}</button>
    <p className="ax-market-note"><ShieldCheck size={13}/> Sem pagamento nesta etapa. O orçamento será confirmado pela nossa equipe.</p>
   </form>}
  </section>
 </div>;
}
