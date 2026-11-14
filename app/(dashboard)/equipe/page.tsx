'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {api} from '@/lib/api';import {useAuth} from '@/contexts/auth-context';
import {ArrowRight,ArrowRightLeft,BarChart3,ChevronRight,Search,ShieldCheck,UserRound,Users,X} from 'lucide-react';
type Pessoa={id:number;nome:string;foto_url?:string;loja?:string;ativo?:boolean;leads?:number;responderam?:number;fichas?:number;aprovados?:number;vendas?:number;pontos?:number;plus_hoje?:number;minus_hoje?:number;plus_mes?:number;minus_mes?:number;leads_em_aberto?:number};
const n=(v:unknown)=>Number(v||0).toLocaleString('pt-BR');
function Stat({label,value}:{label:string;value:unknown}){return <div className="nova-profile-stat"><small>{label}</small><strong>{n(value)}</strong></div>}
export default function EquipePage(){
 const {user}=useAuth();const qc=useQueryClient();const role=String(user?.tipo||'').toLowerCase();
 const manager=role==='gerente',authorized=['gerente','admin','superadmin'].includes(role);const canManage=['admin','superadmin'].includes(role);
 const [loja,setLoja]=useState(manager?String(user?.loja||''):'');const [search,setSearch]=useState('');
 const [empresa,setEmpresa]=useState('');const superadmin=role==='superadmin';
 const empresas=useQuery({queryKey:['equipe-empresas',user?.id],enabled:superadmin,queryFn:async()=>{const r=await api.get('/faturamento/empresas');return Array.isArray(r.data)?r.data as {id:number;nome:string}[]:[];}});
 const empresaId=superadmin?Number(empresa):Number(user?.empresa_id||0);
 const empresaEscolhida=superadmin?empresaId>0:!!user?.empresa_id;
 const [modo,setModo]=useState<'grade'|'lista'>('grade');const [pessoa,setPessoa]=useState<Pessoa|null>(null);const [busy,setBusy]=useState<number|null>(null);
 const {data=[],isLoading,error}=useQuery({queryKey:['equipe',loja,empresaId],enabled:authorized&&empresaEscolhida,queryFn:async()=>{const r=await api.get('/equipe',{params:{...(loja?{loja}:{}),...(superadmin?{empresa_id:empresaId}:{})}});return Array.isArray(r.data)?r.data as Pessoa[]:[];},refetchInterval:60000});
 const lojas=useMemo(()=>Array.from(new Set(data.map(v=>String(v.loja||'').replace('.0','').trim()).filter(Boolean))).sort(),[data]);
 const lista=useMemo(()=>data.filter(v=>String(v.nome||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))),[data,search]);
 async function redistribuir(v:Pessoa){if(v.ativo!==false||!(Number(v.leads_em_aberto)>0)||!authorized)return;
  if(!window.confirm(`Redistribuir aleatoriamente até 80 leads não vendidos de ${v.nome} para vendedores ATIVOS da ${manager?'mesma loja':'mesma empresa'}? Ao cancelar, a carteira permanece com ele.`))return;
  setBusy(v.id);try{const {data:out}=await api.post('/leads/redistribuir-inativo',{vendedor_id:v.id});toast.success(`${out.transferidos} leads redistribuídos. Restantes: ${out.restantes}.`);await Promise.all([qc.invalidateQueries({queryKey:['equipe']}),qc.invalidateQueries({queryKey:['leads']})]);}
  catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível redistribuir os leads.');}finally{setBusy(null);}
 }
 if(!authorized)return <div className="nova-surface p-6">Acesso restrito.</div>;
 return <div className="space-y-5">
  <div className="nova-page-heading"><div><span className="nova-label">Pessoas e produtividade</span><h1 className="mt-2">Equipe</h1><p>Quem está em atividade, desempenho no mês e detalhes de cada vendedor.</p></div><div className="flex items-end gap-2">{canManage&&<Link href="/gestao-usuarios" className="nova-button"><Users size={16}/>Gerenciar acessos</Link>}</div></div>
  <div className="nova-surface nova-panel-pad"><div className="flex flex-wrap items-end gap-3 justify-between"><div className="flex flex-wrap gap-3 items-end"><label className="nova-field">Buscar colaborador<div className="flex items-center gap-2"><Search size={15}/><input placeholder="Nome do colaborador" value={search} onChange={e=>setSearch(e.target.value)}/></div></label>{superadmin&&<label className="nova-field">Empresa<select value={empresa} onChange={e=>{setEmpresa(e.target.value);setLoja('')}}><option value="">Selecione a empresa</option>{(empresas.data||[]).map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>}{!manager&&<label className="nova-field">Loja<select value={loja} onChange={e=>setLoja(e.target.value)}><option value="">Todas as lojas</option>{lojas.map(l=><option key={l} value={l}>{l}</option>)}{loja&&!lojas.includes(loja)&&<option value={loja}>{loja}</option>}</select></label>}</div>
   <div className="flex gap-2"><button className={'nova-button '+(modo==='grade'?'':'ghost')} onClick={()=>setModo('grade')}>Cards</button><button className={'nova-button '+(modo==='lista'?'':'ghost')} onClick={()=>setModo('lista')}>Lista</button></div></div>
   <p className="mt-3 text-xs nova-text-muted">{lista.length} colaborador(es) · Os dados são limitados à empresa e loja autorizadas pelo servidor.</p>
  </div>
  {superadmin&&!empresaEscolhida&&<div className="nova-empty">Selecione uma empresa para consultar a equipe sem misturar concessionárias.</div>}{isLoading&&<div className="nova-empty">Carregando equipe…</div>}{!!error&&<div className="nova-empty">Não foi possível carregar a equipe.</div>}
  {!isLoading&&!lista.length&&<div className="nova-empty">Nenhum colaborador encontrado.</div>}
  {modo==='grade'?<div className="nova-team-grid">{lista.map(v=><button type="button" key={v.id} onClick={()=>setPessoa(v)} className="nova-surface nova-person-card text-left" aria-label={`Ver detalhes de ${v.nome}`}><div className="flex items-center justify-between gap-3"><span className="nova-person-avatar">{v.foto_url?<img className="h-full w-full rounded-[19px] object-cover" alt="" src={v.foto_url}/>:String(v.nome||'?')[0]?.toUpperCase()}</span><span className={'nova-status-pill'+(v.ativo===false?' off':'')}>{v.ativo===false?'Inativo':'Ativo'}</span></div>
   <h3 className="mt-4 text-[15px] font-bold truncate">{v.nome}</h3><p className="text-xs nova-text-muted mt-1">Vendedor · Loja {String(v.loja||'—').replace('.0','')}</p>
   <div className="nova-team-stats"><span><strong>{n(v.leads)}</strong><small>Leads no mês</small></span><span><strong>{n(v.fichas)}</strong><small>Fichas</small></span><span><strong>{n(v.vendas)}</strong><small>Vendas</small></span></div>
   <div className="flex justify-between mt-4 items-center text-xs"><span className="nova-text-muted">{Number(v.pontos||0).toFixed(1)} pontos · <span className="text-emerald-500">+{n(v.plus_hoje)}</span> / <span className="text-rose-500">−{n(v.minus_hoje)}</span> hoje</span><ChevronRight size={16}/></div>
  </button>)}</div>:<div className="nova-surface overflow-hidden">{lista.map(v=><button type="button" onClick={()=>setPessoa(v)} key={v.id} className="nova-list-row w-full text-left px-5 hover:bg-muted/30"><span className="nova-user-avatar">{String(v.nome||'?')[0].toUpperCase()}</span><span className="flex-1 min-w-0"><strong className="truncate">{v.nome}</strong><small>Loja {v.loja||'—'} · Leads {n(v.leads)} · Vendas {n(v.vendas)}</small></span><span className={'nova-status-pill'+(v.ativo===false?' off':'')}>{v.ativo===false?'Inativo':'Ativo'}</span><ChevronRight size={17}/></button>)}</div>}
  {pessoa&&<div className="nova-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setPessoa(null);}}><section className="nova-modal" role="dialog" aria-modal="true" aria-label={'Perfil de '+pessoa.nome} style={{width:'min(760px,100%)'}}><div className="nova-modal-head"><div><span className="nova-label">Perfil do colaborador</span><h2>{pessoa.nome}</h2></div><button aria-label="Fechar" className="nova-icon-button" onClick={()=>setPessoa(null)}><X size={20}/></button></div>
   <div className="nova-profile-pane"><aside className="nova-surface p-4 flex flex-col items-center text-center"><span className="nova-person-avatar" style={{height:80,width:80,fontSize:32}}>{pessoa.foto_url?<img src={pessoa.foto_url} alt="" className="h-full w-full object-cover rounded-[19px]"/>:String(pessoa.nome||'?')[0]?.toUpperCase()}</span><h3 className="font-bold mt-3">{pessoa.nome}</h3><p className="nova-text-muted text-xs mt-1">Vendedor · Loja {pessoa.loja||'—'}</p><span className={'nova-status-pill mt-3'+(pessoa.ativo===false?' off':'')}>{pessoa.ativo===false?'Acesso inativo':'Ativo'}</span><p className="nova-text-muted mt-4 text-xs">Os dados individuais seguem as permissões da equipe e do sistema.</p></aside>
    <div><h3 className="font-bold mb-3">Desempenho no mês</h3><div className="grid grid-cols-2 sm:grid-cols-3 gap-3"><Stat label="Leads" value={pessoa.leads}/><Stat label="Responderam" value={pessoa.responderam}/><Stat label="Fichas" value={pessoa.fichas}/><Stat label="Aprovados" value={pessoa.aprovados}/><Stat label="Vendas" value={pessoa.vendas}/><Stat label="Leads em aberto" value={pessoa.leads_em_aberto}/></div>
     <div className="nova-surface p-4 mt-4"><h4 className="font-bold text-sm mb-2">Movimentações</h4><p className="nova-text-muted text-xs">Hoje: +{n(pessoa.plus_hoje)} recebidos · −{n(pessoa.minus_hoje)} perdidos</p><p className="nova-text-muted text-xs mt-2">No mês: +{n(pessoa.plus_mes)} / −{n(pessoa.minus_mes)} transferências</p><p className="nova-text-muted text-xs mt-2">Pontuação: {Number(pessoa.pontos||0).toFixed(1)}</p></div>
    </div></div>
   <div className="flex flex-wrap gap-2 mt-5 justify-end">{pessoa.ativo===false&&Number(pessoa.leads_em_aberto)>0&&<button type="button" className="nova-button ghost" disabled={busy===pessoa.id} onClick={()=>void redistribuir(pessoa)}><ArrowRightLeft size={15}/>{busy===pessoa.id?'Redistribuindo…':`Redistribuir ${n(pessoa.leads_em_aberto)} leads`}</button>}
    {canManage&&<Link href="/gestao-usuarios" className="nova-button ghost"><ShieldCheck size={15}/>Gerenciar acesso/desligamento <ArrowRight size={14}/></Link>}
    <button className="nova-button" onClick={()=>setPessoa(null)}>Concluir</button></div>
   </section></div>}
 </div>;
}
