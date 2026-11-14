'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {ArrowUpRight,BarChart3,CalendarDays,CheckCheck,ClipboardCheck,FileText,MessageCircleMore,RefreshCw,Users} from 'lucide-react';
import {api} from '@/lib/api';import {useAuth} from '@/contexts/auth-context';
import {LeadQuickDetail} from '@/components/lead-quick-detail';

type Lead={id:number;nome_lead?:string;data_lead?:string;respondeu?:boolean;gerou_ficha?:boolean;venda_concluida?:boolean;data_venda?:string;origem?:string};
type Tarefa={id:number;titulo?:string;resposta?:string|null;destinatario_nome?:string};
function asArray<T>(x:any):T[]{return Array.isArray(x)?x:[]}
function number(v:unknown){return Number(v||0).toLocaleString('pt-BR');}
function Metric({label,val,sub,Icon,to}:{label:string;val:string;sub:string;Icon:any;to:string}){return <Link className="nova-surface nova-metric-card hover:border-primary/40" href={to}><div className="nova-metric-top"><span>{label}</span><span className="nova-metric-icon"><Icon size={18}/></span></div><strong>{val}</strong><small>{sub}</small></Link>}
export default function InicioPage(){
 const {user}=useAuth();const cargo=String(user?.tipo||'').toLowerCase();const superadmin=cargo==='superadmin';
 const comercial=['superadmin','admin','gerente','marketing','vendedor'].includes(cargo);
 const podeMetricas=['gerente','admin','superadmin','marketing'].includes(cargo);
 const [empresa,setEmpresa]=useState('');
 const [leadAberto,setLeadAberto]=useState<number|null>(null);
 const empresasQ=useQuery({queryKey:['inicio-empresas',user?.id],enabled:superadmin,queryFn:async()=>asArray<{id:number;nome:string}>((await api.get('/faturamento/empresas')).data)});
 useEffect(()=>{if(superadmin&&empresasQ.data?.length&&!empresa)setEmpresa(String(empresasQ.data[0].id));},[superadmin,empresasQ.data,empresa]);
 const empresaId=superadmin?Number(empresa):Number(user?.empresa_id||0);
 const pronto=comercial&&empresaId>0;
 const leadsQ=useQuery({queryKey:['inicio-leads',empresaId,user?.id],enabled:pronto,queryFn:async()=>asArray<Lead>((await api.get('/leads',{params:{filtro:'todos',periodo:'todas',empresa_id:superadmin?empresaId:undefined}})).data),refetchInterval:60000});
 const statsQ=useQuery({queryKey:['inicio-estatisticas',empresaId,user?.id],enabled:pronto,queryFn:async()=> (await api.get('/leads/stats',{params:{periodo:'mes',empresa_id:superadmin?empresaId:undefined}})).data,refetchInterval:60000});
 const tasksQ=useQuery({queryKey:['inicio-tarefas',user?.id],enabled:!!user&&!superadmin,queryFn:async()=>asArray<Tarefa>((await api.get('/tarefas')).data),refetchInterval:60000});
 const equipeQ=useQuery({queryKey:['inicio-equipe',empresaId],enabled:empresaId>0&&['superadmin','admin','gerente'].includes(cargo),queryFn:async()=>asArray<any>((await api.get('/equipe',{params:{empresa_id:superadmin?empresaId:undefined}})).data)});
 const dados=statsQ.data||{},leads=leadsQ.data||[],tarefas=tasksQ.data||[];
 const hoje=new Date();const keyMes=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
 const chart=useMemo(()=>Array.from({length:6},(_,idx)=>{const d=new Date(hoje.getFullYear(),hoje.getMonth()-5+idx,1),key=keyMes(d);return {mes:d.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),leads:leads.filter(l=>String(l.data_lead||'').slice(0,7)===key).length,vendas:leads.filter(l=>String(l.data_venda||'').slice(0,7)===key).length};}),[leads]);
 const newVisits=leads.filter(l=>{const v=(l as any).data_hora_visita||(l as any).data_agendamento;return v&&String(v).slice(0,10)===new Date().toISOString().slice(0,10)});
 const naoRespondidos=leads.filter(l=>!l.respondeu).slice(0,4),tarefasPendentes=tarefas.filter(t=>t.resposta==null);
 return <div className="space-y-5">
  <div className="nova-page-heading"><div><span className="nova-label">Central de operações</span><h1 className="mt-2">Bom trabalho, {String(user?.nome||user?.login||'equipe').split(' ')[0]}.</h1><p>Dados reais das suas permissões. Um resumo para decidir o que fazer agora.</p></div>
   <div className="flex items-end gap-2">{superadmin&&<label className="nova-field">Empresa<select value={empresa} onChange={e=>setEmpresa(e.target.value)}><option value="">Selecione</option>{(empresasQ.data||[]).map(x=><option key={x.id} value={String(x.id)}>{x.nome}</option>)}</select></label>}<Link className="nova-button" href="/agenda"><CalendarDays size={17}/>Minha agenda</Link></div>
  </div>
  {!comercial&&<div className="nova-surface p-5 text-sm text-muted-foreground">Os indicadores comerciais são restritos ao atendimento. Você pode consultar suas tarefas e a agenda nos atalhos abaixo.</div>}
  {comercial&&!pronto&&<div className="nova-surface p-5 text-sm">Selecione a empresa para consultar os indicadores sem misturar dados de outras concessionárias.</div>}
  {pronto&&<><div className="nova-metric-grid">
   <Metric label="Leads no mês" val={statsQ.isLoading?'…':number(dados.total_leads)} sub="Leads recebidos no período" Icon={Users} to="/painel"/>
   <Metric label="Respondidos" val={statsQ.isLoading?'…':number(dados.total_responderam)} sub="Atendimento registrado" Icon={MessageCircleMore} to="/painel"/>
   <Metric label="Fichas geradas" val={statsQ.isLoading?'…':number(dados.total_fichas)} sub="Crédito em acompanhamento" Icon={FileText} to="/fichas"/>
   <Metric label="Vendas" val={statsQ.isLoading?'…':number(dados.total_vendidos)} sub="Vendas concluídas no CRM" Icon={CheckCheck} to="/painel"/>
  </div>
  <div className="nova-dashboard-grid"><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>Evolução comercial</h2><p>Leads e vendas por mês, a partir dos registros acessíveis.</p></div>{podeMetricas&&<Link href="/metricas" className="nova-secondary-link">Detalhes <ArrowUpRight size={14}/></Link>}</div>
   {leadsQ.isError?<div className="nova-empty">Não foi possível carregar os leads deste escopo.</div>:<div style={{width:'100%',height:280}}><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{top:10,right:10,left:-22,bottom:0}}><defs><linearGradient id="novaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7771f5" stopOpacity={.24}/><stop offset="100%" stopColor="#7771f5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 7" vertical={false} stroke="rgba(150,154,180,.18)"/><XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11}/><YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11}/><Tooltip contentStyle={{borderRadius:12,fontSize:12}}/><Area type="monotone" dataKey="leads" stroke="#6968eb" strokeWidth={2.5} fill="url(#novaGrad)" name="Leads"/><Area type="monotone" dataKey="vendas" stroke="#15ae8c" strokeWidth={2} fillOpacity={0} name="Vendas"/></AreaChart></ResponsiveContainer></div>}
  </section><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>Precisam de atenção</h2><p>Atalhos para leads ainda não respondidos.</p></div><Link className="nova-secondary-link" href="/painel">Ver leads <ArrowUpRight size={14}/></Link></div>
   {naoRespondidos.length?naoRespondidos.map(l=><button type="button" onClick={()=>setLeadAberto(l.id)} className="nova-list-row w-full text-left" key={l.id}><span className="nova-list-icon"><Users size={17}/></span><span className="min-w-0 flex-1"><strong className="truncate">{l.nome_lead||`Lead #${l.id}`}</strong><small>{l.origem||'Origem não informada'} · Aguardando resposta</small></span><ArrowUpRight size={16} className="text-muted-foreground"/></button>):<div className="nova-empty">{leadsQ.isLoading?'Carregando dados…':'Nenhum lead pendente de resposta no recorte.'}</div>}
  </section></div></>}
  <div className="nova-dashboard-grid"><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>Tarefas em aberto</h2><p>Acompanhamento da rotina da equipe.</p></div><Link href="/tarefas" className="nova-secondary-link">Todas as tarefas <ArrowUpRight size={14}/></Link></div>
   {tasksQ.isError?<div className="nova-empty">Não foi possível carregar tarefas.</div>:tarefasPendentes.length?tarefasPendentes.slice(0,5).map(t=><Link href="/tarefas" className="nova-list-row" key={t.id}><span className="nova-list-icon"><ClipboardCheck size={17}/></span><span className="min-w-0"><strong>{t.titulo||`Tarefa #${t.id}`}</strong><small>{t.destinatario_nome||'Destinatário registrado no sistema'} · Pendente</small></span></Link>):<div className="nova-empty">{superadmin?'Consulte Tarefas para ver todas as empresas sem misturar os indicadores desta empresa.':'Nenhuma tarefa pendente.'}</div>}
  </section><section className="nova-surface nova-panel-pad"><div className="nova-panel-head"><div><h2>Atalhos do dia</h2><p>Ferramentas frequentes do seu trabalho.</p></div></div>
    <Link href="/agenda" className="nova-list-row"><span className="nova-list-icon"><CalendarDays size={18}/></span><span><strong>Agenda e compromissos</strong><small>{newVisits.length} visita(s) encontrada(s) para hoje</small></span><ArrowUpRight className="ml-auto" size={16}/></Link>
    <Link href="/tarefas" className="nova-list-row"><span className="nova-list-icon"><ClipboardCheck size={18}/></span><span><strong>Tarefas e retornos</strong><small>{tarefasPendentes.length} tarefa(s) pendente(s)</small></span><ArrowUpRight className="ml-auto" size={16}/></Link>
    {['admin','gerente','superadmin'].includes(cargo)&&<Link href="/equipe" className="nova-list-row"><span className="nova-list-icon"><BarChart3 size={18}/></span><span><strong>Equipe</strong><small>{equipeQ.data?.length||0} colaborador(es) na consulta atual</small></span><ArrowUpRight className="ml-auto" size={16}/></Link>}
    {['admin','superadmin'].includes(cargo)&&<Link href="/financas" className="nova-list-row"><span className="nova-list-icon"><RefreshCw size={18}/></span><span><strong>Finanças</strong><small>Contas e recebimentos documentados</small></span><ArrowUpRight className="ml-auto" size={16}/></Link>}
   </section></div>
  {leadAberto!==null&&<LeadQuickDetail leadId={leadAberto} onClose={()=>setLeadAberto(null)}/>}
 </div>;
}
