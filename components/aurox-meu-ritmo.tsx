'use client';
import {useMemo} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {useAuth} from '@/contexts/auth-context';
import {ArrowUpRight,CalendarDays,CheckCheck,ClipboardCheck,MessageCircleMore,Target,UsersRound} from 'lucide-react';
import './aurox-meu-ritmo.css';

type Stats={total_leads:number;total_responderam:number;total_fichas:number;total_aprovados:number;total_vendidos:number};
type Task={id:number;destinatario_id:number;resposta?:string|null};
const n=(v:unknown)=>Math.max(0,Number(v||0));
const done=(s?:string|null)=>/^(concluid|feita|feito|sim|finaliz|realiz)/i.test(String(s||''));
const show=(v:number|undefined,loading:boolean,available:boolean)=>loading?'…':available?String(v??0):'—';

export function AuroxMeuRitmo(){
 const {user}=useAuth();const uid=Number(user?.id||0),vid=Number(user?.vendedor_id||0),eid=Number(user?.empresa_id||0);
 const role=String(user?.tipo||'').toLowerCase();const isSales=['vendedor','admin','gerente','marketing','superadmin'].includes(role)&&vid>0&&eid>0;
 const params={periodo:'mes',empresa_id:eid,vendedor_id:vid};
 const month=useQuery<Stats>({queryKey:['meu-ritmo-mes',uid,vid,eid],enabled:isSales,queryFn:async()=> (await api.get('/leads/stats',{params})).data as Stats,staleTime:45000});
 const prev=useQuery<Stats>({queryKey:['meu-ritmo-anterior',uid,vid,eid],enabled:isSales,queryFn:async()=> (await api.get('/leads/stats',{params:{...params,periodo:'mes_passado'}})).data as Stats,staleTime:45000});
 const tasks=useQuery<Task[]>({queryKey:['meu-ritmo-tarefas',uid],enabled:uid>0,queryFn:async()=>{const r=await api.get('/tarefas');return Array.isArray(r.data)?r.data as Task[]:[]},staleTime:30000});
 const mine=useMemo(()=> (tasks.data||[]).filter(t=>Number(t.destinatario_id)===uid),[tasks.data,uid]);
 const pending=mine.filter(t=>!done(t.resposta)).length,completed=mine.length-pending;
 const salesReady=isSales&&month.isSuccess,taskReady=tasks.isSuccess;
 const sent=n(month.data?.total_leads),answered=n(month.data?.total_responderam),sold=n(month.data?.total_vendidos),files=n(month.data?.total_fichas);
 const conversion=sent>0?Math.min(100,Math.round(sold/sent*100)):0;
 const response=sent>0?Math.min(100,Math.round(answered/sent*100)):0;
 const max=Math.max(sent,sold,n(prev.data?.total_leads),n(prev.data?.total_vendidos),1);
 const bars=[{name:'Leads',previous:n(prev.data?.total_leads),now:sent},{name:'Vendas',previous:n(prev.data?.total_vendidos),now:sold}];
 return <section className="aurox-ritmo" aria-labelledby="aurox-ritmo-title">
  <div className="aurox-ritmo-heading"><div><span className="aurox-ritmo-eyebrow">Seu espaço de trabalho</span><h2 id="aurox-ritmo-title">Meu ritmo no mês</h2><p>Uma visão pessoal. O panorama da empresa continua na Visão Geral.</p></div><Link href="/inicio">Visão geral <ArrowUpRight size={15}/></Link></div>
  <div className="aurox-ritmo-cards">
   <article><span className="aurox-ritmo-icon violet"><UsersRound size={18}/></span><small>Leads acompanhados</small><strong>{show(sent,month.isLoading,salesReady)}</strong><span>Na sua carteira ativa neste mês</span></article>
   <article><span className="aurox-ritmo-icon blue"><MessageCircleMore size={18}/></span><small>Respondidos</small><strong>{show(answered,month.isLoading,salesReady)}</strong><span>Leads com resposta registrada</span></article>
   <article><span className="aurox-ritmo-icon teal"><CheckCheck size={18}/></span><small>Vendas</small><strong>{show(sold,month.isLoading,salesReady)}</strong><span>Vendas vinculadas à carteira</span></article>
   <article><span className="aurox-ritmo-icon amber"><ClipboardCheck size={18}/></span><small>Tarefas pendentes</small><strong>{show(pending,tasks.isLoading,taskReady)}</strong><span>{taskReady?`${completed} concluída(s)`:'Acompanhamento pessoal'}</span></article>
  </div>
  <div className="aurox-ritmo-panels">
   <div className="aurox-ritmo-panel"><h3><Target size={17}/> Progresso de atendimento</h3>
    {salesReady?<><div className="aurox-ritmo-progress-head"><span>Taxa de resposta</span><strong>{response}%</strong></div><div className="aurox-ritmo-track" role="progressbar" aria-label="Taxa de resposta" aria-valuenow={response} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${response}%`}}/></div><div className="aurox-ritmo-progress-head"><span>Conversão de leads em vendas</span><strong>{conversion}%</strong></div><div className="aurox-ritmo-track second" role="progressbar" aria-label="Conversão em vendas" aria-valuenow={conversion} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${conversion}%`}}/></div><p className="aurox-ritmo-footnote">{files} ficha(s) gerada(s) neste mês.</p></>:<p className="aurox-ritmo-muted">{month.isLoading?'Carregando seus indicadores…':isSales?'Indicadores indisponíveis no momento.':'Este acesso não está vinculado a uma carteira de vendedor. As tarefas pessoais continuam disponíveis.'}</p>}
   </div>
   <div className="aurox-ritmo-panel"><h3><CalendarDays size={17}/> Comparativo mensal</h3>
    {salesReady&&prev.isSuccess?<><div className="aurox-ritmo-legend"><span><i/>Mês anterior</span><span><i/>Mês atual</span></div>{bars.map(x=><div key={x.name} className="aurox-ritmo-bar-row"><div><span>{x.name}</span><small>{x.previous} / {x.now}</small></div><div className="aurox-ritmo-bars"><i style={{width:`${Math.round(x.previous/max*100)}%`}}/><b style={{width:`${Math.round(x.now/max*100)}%`}}/></div></div>)}</>:<p className="aurox-ritmo-muted">{month.isLoading||prev.isLoading&&isSales?'Comparando os dois períodos…':'Comparativo disponível quando sua carteira comercial estiver vinculada e acessível.'}</p>}
   </div>
  </div>
 </section>;
}
