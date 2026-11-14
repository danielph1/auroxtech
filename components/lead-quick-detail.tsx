'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {CalendarDays,Heart,MessageCircle,Pin,Phone,UserRound,FileText,SquarePen,ArrowRightLeft,Clock3} from 'lucide-react';
import {api} from '@/lib/api';
import {useFavoritos} from '@/contexts/favoritos-context';
import {useAuth} from '@/contexts/auth-context';
import {AuroxModalBase} from '@/components/aurox-modal-base';

export type LeadResumo={id:number;nome_lead?:string;telefone?:string;origem?:string;loja?:string;produto_interesse?:string;observacao?:string;
 comentario_interno?:string;data_lead?:string;data_hora_visita?:string;data_agendamento?:string;vendedor_nome?:string;
 vendedor?:{nome?:string;loja?:string};respondeu?:boolean;status?:string;placa_carro?:string};
const texto=(v:unknown)=>String(v||'').trim()||'Não informado';
function dataBr(v:unknown){if(!v)return 'Não agendado';const d=new Date(String(v));return Number.isNaN(d.getTime())?String(v):d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
function whatsappLink(t:string){const digits=t.replace(/\D/g,'');if(digits.length!==10&&digits.length!==11&&!(digits.startsWith('55')&&(digits.length===12||digits.length===13)))return null;
 return `https://wa.me/${digits.startsWith('55')?digits:'55'+digits}`;}
export function LeadQuickDetail({leadId,onClose}:{leadId:number;onClose:()=>void}){
 const {user}=useAuth();const fav=useFavoritos();const qc=useQueryClient();
 const [fixado,setFixado]=useState(false);
 const {data:lead,isLoading,error}=useQuery<LeadResumo>({queryKey:['studio-lead-detalhe',leadId,user?.id],queryFn:async()=> (await api.get(`/leads/${leadId}`)).data,enabled:leadId>0});
 useEffect(()=>{try{setFixado((JSON.parse(localStorage.getItem('manu.lead.pins')||'[]') as number[]).includes(leadId));}catch{setFixado(false)}},[leadId]);
 function togglePin(){try{const old=JSON.parse(localStorage.getItem('manu.lead.pins')||'[]');const items=Array.isArray(old)?old.map(Number).filter((x:number)=>Number.isSafeInteger(x)):[];
  const updated=items.includes(leadId)?items.filter((x:number)=>x!==leadId):[...items.slice(-2),leadId];
  localStorage.setItem('manu.lead.pins',JSON.stringify(updated));setFixado(updated.includes(leadId));qc.invalidateQueries({queryKey:['leads']});
 }catch{}}
 const contato=lead?.telefone?whatsappLink(lead.telefone):null;
 const papel=String(user?.tipo||'').toLowerCase();const chat=['vendedor','marketing','gerente','admin','superadmin'].includes(papel);
 return <AuroxModalBase wide title={lead?.nome_lead||`Lead #${leadId}`} eyebrow="Detalhes do lead" subtitle="Informações completas autorizadas pelo servidor" onClose={onClose}
  footer={<div className="studio-actions">{chat&&<Link className="studio-btn primary" href={`/chat?lead=${leadId}`}><MessageCircle size={16}/>Abrir conversa</Link>}
    {contato&&<a className="studio-btn" href={contato} target="_blank" rel="noopener noreferrer"><Phone size={16}/>WhatsApp externo</a>}
    <Link className="studio-btn" href="/painel"><SquarePen size={16}/>Gerenciar lead</Link></div>}>
  {isLoading?<div className="studio-empty">Carregando lead…</div>:error||!lead?<div className="studio-empty">Não foi possível consultar este lead. Confira suas permissões.</div>:<>
   <div className="studio-lead-head"><span className="studio-avatar big"><UserRound size={26}/></span><div><strong>{texto(lead.nome_lead)}</strong><small>{lead.respondeu?'Atendimento registrado':'Aguardando resposta'} · {texto(lead.origem)}</small></div></div>
   <div className="studio-info-grid">
    <div className="studio-info"><small>Telefone</small><strong>{texto(lead.telefone)}</strong></div>
    <div className="studio-info"><small>Loja</small><strong>{texto(lead.vendedor?.loja||lead.loja)}</strong></div>
    <div className="studio-info"><small>Responsável</small><strong>{texto(lead.vendedor_nome||lead.vendedor?.nome)}</strong></div>
    <div className="studio-info"><small>Chegada</small><strong>{dataBr(lead.data_lead)}</strong></div>
    <div className="studio-info"><small>Veículo / Interesse</small><strong>{texto(lead.produto_interesse)}</strong></div>
    <div className="studio-info"><small>Visita / retorno</small><strong>{dataBr(lead.data_hora_visita||lead.data_agendamento)}</strong></div>
   </div>
   <div className="studio-note"><strong>Observações</strong><p>{texto(lead.observacao)}</p></div>
   {lead.comentario_interno&&<div className="studio-note"><strong>Comentário interno</strong><p>{lead.comentario_interno}</p></div>}
   <div className="studio-actions studio-quiet-actions"><button className="studio-btn" onClick={()=>fav.toggle(leadId)} type="button"><Heart size={16} fill={fav.tem(leadId)?'currentColor':'none'}/>{fav.tem(leadId)?'Desfavoritar':'Favoritar'}</button>
    <button className="studio-btn" onClick={togglePin} type="button"><Pin size={16}/>{fixado?'Desafixar':'Fixar'}</button>
    <Link className="studio-btn" href="/agenda"><CalendarDays size={16}/>Agenda</Link>
    {chat&&<Link className="studio-btn" href="/fichas"><FileText size={16}/>Fichas</Link>}
    <Link className="studio-btn" href="/painel"><ArrowRightLeft size={16}/>Transferir / Follow Up</Link></div>
   <p className="studio-tip"><Clock3 size={14}/>Ações que dependem de regras específicas continuam disponíveis nas páginas originais.</p>
  </>}
 </AuroxModalBase>;
}
