'use client';
import {useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {api} from '@/lib/api';import {useAuth} from '@/contexts/auth-context';
import {ArrowLeft,ArrowRight,CalendarDays,ChevronLeft,ChevronRight,Clock3,FileText,Plus,Users,X} from 'lucide-react';
type Evento={id:string;data:string;hora?:string;tipo:'visita'|'retorno'|'entrada'|'saida'|'tarefa';titulo:string;sub?:string;href:string;valor?:number};
type Lead={id:number;nome_lead:string;empresa_id?:number;data_hora_visita?:string;data_agendamento?:string};
type Parcela={id:number;agendamento_id:number;vencimento:string;descricao:string;tipo:'entrada'|'saida';valor:number|null;status:string;origem?:string;recebido?:number;desconto?:number};
type Promessa={id:number;vencimento:string;cliente:string;valor:number;recebido:number;ativo:boolean};
function arr<T>(v:any):T[]{return Array.isArray(v)?v:[];}
function key(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function dateLabel(k:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return k;const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});}
function money(v:number){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);}
function calendarDays(y:number,m:number){const begin=new Date(y,m,1);const start=begin.getDay();const days=new Date(y,m+1,0).getDate();const count=Math.ceil((days+start)/7)*7;return Array.from({length:count},(_,i)=>new Date(y,m,i-start+1));}
const COLORS:Record<Evento['tipo'],string>={visita:'',retorno:'',entrada:'entrada',saida:'saida',tarefa:''};
export default function AgendaPage(){
 const {user}=useAuth();const role=String(user?.tipo||'').toLowerCase();const superadmin=role==='superadmin';const comercial=['vendedor','gerente','admin','superadmin','marketing'].includes(role);
 const financas=['superadmin','admin'].includes(role);const [empresa,setEmpresa]=useState('');
 const empresasQ=useQuery({queryKey:['agenda-empresas',user?.id],enabled:superadmin,queryFn:async()=>arr<{id:number;nome:string}>((await api.get('/faturamento/empresas')).data)});
 useEffect(()=>{if(superadmin&&empresasQ.data?.length&&!empresa)setEmpresa(String(empresasQ.data[0].id));},[superadmin,empresa,empresasQ.data]);
 const empresaId=superadmin?Number(empresa):Number(user?.empresa_id||0);
 const [date,setDate]=useState(()=>new Date());const [selected,setSelected]=useState(()=>key(new Date()));
 const [filter,setFilter]=useState('todos');const [show,setShow]=useState(false);
 const [modalKind,setModalKind]=useState<'visita'|'retorno'>('visita');const [leadId,setLeadId]=useState('');
 const [diaNovo,setDiaNovo]=useState(()=>key(new Date()));const [horaNovo,setHoraNovo]=useState('10:00');const [modalMonth,setModalMonth]=useState(()=>new Date());const [saving,setSaving]=useState(false);
 const qc=useQueryClient();
 const leadsQ=useQuery({queryKey:['agenda-leads',empresaId,user?.id],enabled:comercial&&empresaId>0,queryFn:async()=>arr<Lead>((await api.get('/leads',{params:{periodo:'todas',filtro:'todos',empresa_id:superadmin?empresaId:undefined}})).data),refetchInterval:60000});
 const finQ=useQuery({queryKey:['agenda-financas',empresaId],enabled:financas&&empresaId>0,queryFn:async()=>(await api.get('/financas',{params:{empresa_id:superadmin?empresaId:undefined}})).data,refetchInterval:60000});
 const taskQ=useQuery({queryKey:['agenda-tarefas',user?.id],enabled:!!user&&!superadmin,queryFn:async()=>arr<any>((await api.get('/tarefas')).data),refetchInterval:60000});
 const events=useMemo(()=>{
  const items:Evento[]=[];
  for(const l of leadsQ.data||[]){const fields:[string|undefined,'visita'|'retorno'][]=[[l.data_hora_visita,'visita'],[l.data_agendamento,'retorno']];
   for(const [s,t] of fields){if(!s)continue;const v=String(s);if(!/^\d{4}-\d{2}-\d{2}/.test(v))continue;items.push({id:`lead-${l.id}-${t}`,data:v.slice(0,10),hora:v.slice(11,16)||undefined,tipo:t,titulo:l.nome_lead||`Lead #${l.id}`,sub:t==='visita'?'Visita agendada':'Retorno agendado',href:'/painel'});}
  }
  for(const p of arr<Parcela>(finQ.data?.parcelas)){
   if(p.origem==='aurox'||!p.vencimento||['cancelado','pago'].includes(String(p.status)))continue;
   const saldo=Number(p.valor||0)-Number(p.recebido||0)-Number(p.desconto||0);if(saldo<=0)continue;
   items.push({id:`parcela-${p.id}`,data:String(p.vencimento).slice(0,10),tipo:p.tipo,titulo:p.descricao,sub:p.tipo==='entrada'?'A receber':'A pagar',href:'/financas',valor:saldo});
  }
  for(const p of arr<Promessa>(finQ.data?.promessas)){const saldo=Number(p.valor||0)-Number(p.recebido||0);if(!p.ativo||!p.vencimento||saldo<=0)continue;
   items.push({id:`promessa-${p.id}`,data:String(p.vencimento).slice(0,10),tipo:'entrada',titulo:p.cliente||'Recebimento de venda',sub:'Recebimento agendado',href:'/financas',valor:saldo});
  }
  for(const t of taskQ.data||[]){const k=String(t.vencimento||t.prazo||t.data_agendada||'').slice(0,10);
   if(!/^\d{4}-\d{2}-\d{2}$/.test(k))continue;items.push({id:`tarefa-${t.id}`,data:k,tipo:'tarefa',titulo:t.titulo||'Tarefa',sub:t.resposta==null?'Pendente':'Concluída',href:'/tarefas'});}
  return items.sort((a,b)=>a.data.localeCompare(b.data)||(a.hora||'').localeCompare(b.hora||''));
 },[leadsQ.data,finQ.data,taskQ.data]);
 const filtered=filter==='todos'?events:events.filter(e=>e.tipo===filter);
 const counts=new Map<string,Evento[]>();for(const e of filtered)counts.set(e.data,[...(counts.get(e.data)||[]),e]);
 const year=date.getFullYear(),month=date.getMonth();const dates=calendarDays(year,month);
 const today=key(new Date()),dayEvents=counts.get(selected)||[];
 function navigate(delta:number){const d=new Date(year,month+delta,1);setDate(d);setSelected(key(d));}
 function openModal(){setDiaNovo(selected);setModalMonth(new Date(Number(selected.slice(0,4)),Number(selected.slice(5,7))-1,1));setShow(true);setLeadId('');}
 async function schedule(e:FormEvent){e.preventDefault();if(!leadId||!diaNovo||!horaNovo)return toast.error('Preencha cliente, dia e horário');if(saving)return;
  setSaving(true);try{await api.put(`/leads/${encodeURIComponent(leadId)}`,{[modalKind==='visita'?'data_hora_visita':'data_agendamento']:`${diaNovo}T${horaNovo}:00`});toast.success('Agendamento salvo no cadastro do lead.');await qc.invalidateQueries({queryKey:['agenda-leads']});await qc.invalidateQueries({queryKey:['leads']});setShow(false);setSelected(diaNovo);setDate(new Date(Number(diaNovo.slice(0,4)),Number(diaNovo.slice(5,7))-1,1));}
  catch(err:any){toast.error(err?.response?.data?.error||'Não foi possível agendar. Confira sua permissão para este lead.');}finally{setSaving(false);}}
 const loading=leadsQ.isLoading||finQ.isLoading||taskQ.isLoading;
 const hasError=leadsQ.isError||finQ.isError||taskQ.isError;
 return <div className="space-y-4">
  <div className="nova-page-heading"><div><span className="nova-label">Organização do dia</span><h1 className="mt-2">Agenda de trabalho</h1><p>Visitas, retornos, tarefas com prazo e compromissos financeiros autorizados.</p></div>
   <div className="flex flex-wrap items-end gap-2">{superadmin&&<label className="nova-field">Empresa<select value={empresa} onChange={e=>setEmpresa(e.target.value)}><option value="">Selecione</option>{(empresasQ.data||[]).map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>}
   {comercial&&<button type="button" className="nova-button" onClick={openModal}><Plus size={16}/>Agendar</button>}</div>
  </div>
  <div className="nova-surface nova-panel-pad"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="nova-metric-icon"><CalendarDays size={18}/></span><div><h2 className="font-bold text-lg">{date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</h2><p className="text-[11px] nova-text-muted">Selecione um dia para abrir todos os compromissos.</p></div></div>
   <div className="flex items-center gap-2"><button type="button" className="nova-button ghost" onClick={()=>{const d=new Date();setDate(d);setSelected(key(d));}}>Hoje</button><button className="nova-icon-button border" aria-label="Mês anterior" onClick={()=>navigate(-1)}><ChevronLeft size={18}/></button><button className="nova-icon-button border" aria-label="Mês seguinte" onClick={()=>navigate(1)}><ChevronRight size={18}/></button></div></div>
  <div className="mt-4 flex flex-wrap gap-2">{[{id:'todos',name:'Todos'},{id:'visita',name:'Visitas'},{id:'retorno',name:'Retornos'},{id:'tarefa',name:'Tarefas'},...(financas?[{id:'entrada',name:'A receber'},{id:'saida',name:'A pagar'}]:[])].map(f=><button type="button" key={f.id} onClick={()=>setFilter(f.id)} className={'rounded-full px-3 py-1.5 text-xs border '+(filter===f.id?'bg-primary text-primary-foreground border-primary':'text-muted-foreground border-border hover:bg-muted')}>{f.name}</button>)}</div>
  </div>
  {hasError&&<div className="nova-surface p-4 text-xs text-rose-500">Algumas agendas não puderam ser carregadas; os itens exibidos são apenas os registros disponíveis.</div>}
  <div className="nova-calendar-wrap"><section className="nova-surface nova-panel-pad"><div className="nova-calendar-grid">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><div className="nova-calendar-weekday" key={x}>{x}</div>)}
   {dates.map(d=>{const dk=key(d),list=counts.get(dk)||[];const selectedDay=dk===selected;return <button type="button" key={dk} className={'nova-calendar-cell'+(d.getMonth()!==month?' is-outside':'')+(selectedDay?' is-selected':'')} onClick={()=>{setSelected(dk);if(d.getMonth()!==month)setDate(new Date(d.getFullYear(),d.getMonth(),1));}} aria-pressed={selectedDay} aria-label={`${dateLabel(dk)}: ${list.length} eventos`}><span className="date"><span className={dk===today?'is-today':''}>{d.getDate()}</span></span>{list.slice(0,2).map(e=><span key={e.id} className={'nova-calendar-event '+COLORS[e.tipo]}>{e.tipo==='entrada'?'↓ ':e.tipo==='saida'?'↑ ':''}{e.titulo}</span>)}{list.length>2&&<small className="nova-text-muted text-[9px]">+{list.length-2} eventos</small>}{list.length>0&&<span className="nova-event-count hidden nova-text-muted">{list.length} eventos</span>}</button>})}
   </div></section>
   <aside className="space-y-4"><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>{dateLabel(selected)}</h2><p>{dayEvents.length} compromisso(s) do dia selecionado</p></div></div>
    {!dayEvents.length?<div className="nova-empty">{loading?'Carregando agenda…':'Nenhum compromisso neste dia.'}</div>:dayEvents.map(e=><Link href={e.href} key={e.id} className="nova-list-row"><span className="nova-list-icon"><span className={'nova-dot '+COLORS[e.tipo]}/></span><span className="flex-1 min-w-0"><strong className="truncate">{e.titulo}</strong><small>{e.hora?`${e.hora} · `:''}{e.sub||e.tipo}{e.valor!=null?` · ${money(e.valor)}`:''}</small></span><ChevronRight size={14}/></Link>)}
    {comercial&&<button type="button" className="nova-button ghost mt-4 w-full" onClick={openModal}><Plus size={15}/>Novo agendamento</button>}
   </section><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>Legenda</h2><p>As cores ajudam a reconhecer a natureza do evento.</p></div></div><div className="grid gap-3 text-xs"><span><i className="nova-dot"/>Visita, retorno ou tarefa</span>{financas&&<><span><i className="nova-dot entrada"/>Valores a receber</span><span><i className="nova-dot saida"/>Valores a pagar</span></>}</div></section></aside></div>
  {show&&<div className="nova-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShow(false)}}><section role="dialog" aria-modal="true" aria-label="Novo agendamento" className="nova-modal"><div className="nova-modal-head"><div><span className="nova-label">Novo compromisso</span><h2>Adicionar agendamento</h2></div><button className="nova-icon-button" aria-label="Fechar" onClick={()=>setShow(false)}><X size={20}/></button></div>
   <p className="mb-4 text-xs nova-text-muted">Agende uma visita ou retorno para um lead da sua carteira. Recebimentos e contas continuam sendo registrados em Finanças.</p>
   <form onSubmit={schedule} className="space-y-4"><div className="nova-mode-grid"><button type="button" className={modalKind==='visita'?'is-active':''} onClick={()=>setModalKind('visita')}>◉ Visita</button><button type="button" className={modalKind==='retorno'?'is-active':''} onClick={()=>setModalKind('retorno')}>◉ Retorno</button>{financas?<Link href="/financas" className="text-center border border-border rounded-[10px] py-3 text-[11px] font-semibold">◉ Financeiro</Link>:<Link href="/tarefas" className="text-center border border-border rounded-[10px] py-3 text-[11px] font-semibold">◉ Tarefas</Link>}</div>
    <label className="nova-field">Cliente/Lead<select required value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Selecione um lead</option>{(leadsQ.data||[]).map(l=><option key={l.id} value={l.id}>{l.nome_lead||`Lead #${l.id}`} · #{l.id}</option>)}</select></label>
    <div className="nova-surface p-3"><div className="flex justify-between items-center mb-2"><strong className="text-sm capitalize">{modalMonth.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</strong><span className="flex gap-1"><button type="button" aria-label="Mês anterior" className="nova-icon-button" onClick={()=>setModalMonth(new Date(modalMonth.getFullYear(),modalMonth.getMonth()-1,1))}><ChevronLeft size={17}/></button><button type="button" aria-label="Próximo mês" className="nova-icon-button" onClick={()=>setModalMonth(new Date(modalMonth.getFullYear(),modalMonth.getMonth()+1,1))}><ChevronRight size={17}/></button></span></div><div className="nova-mini-cal">{['D','S','T','Q','Q','S','S'].map((d,i)=><span key={i} className="font-semibold nova-text-muted">{d}</span>)}{calendarDays(modalMonth.getFullYear(),modalMonth.getMonth()).map(d=>{const v=key(d),chosen=v===diaNovo;return <button type="button" key={v} aria-pressed={chosen} aria-label={dateLabel(v)} className={'nova-mini-day'+(chosen?' is-selected':'')+(d.getMonth()!==modalMonth.getMonth()?' is-outside':'')} onClick={()=>{setDiaNovo(v);if(d.getMonth()!==modalMonth.getMonth())setModalMonth(new Date(d.getFullYear(),d.getMonth(),1));}}>{d.getDate()}</button>})}</div></div>
    <div className="grid grid-cols-2 gap-3"><label className="nova-field">Data escolhida<input type="date" required value={diaNovo} onChange={e=>{setDiaNovo(e.target.value);if(e.target.value)setModalMonth(new Date(Number(e.target.value.slice(0,4)),Number(e.target.value.slice(5,7))-1,1));}}/></label><label className="nova-field">Horário<input type="time" required value={horaNovo} onChange={e=>setHoraNovo(e.target.value)}/></label></div>
    <div className="nova-surface p-3 text-xs nova-text-muted"><Clock3 size={15} className="inline mr-2"/>O horário será salvo no campo de {modalKind==='visita'?'visita':'retorno'} do lead. Nenhum dado financeiro será lançado automaticamente.</div>
    <div className="flex items-center justify-end gap-2"><button type="button" onClick={()=>setShow(false)} className="nova-button ghost">Cancelar</button><button className="nova-button" disabled={saving||!leadId}>{saving?'Salvando…':'Salvar agendamento'}</button></div>
   </form></section></div>}
 </div>;
}
