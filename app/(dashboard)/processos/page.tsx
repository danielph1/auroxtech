'use client';
import {useMemo,useState,type FormEvent} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '@/lib/api';import {useAuth} from '@/contexts/auth-context';
import {AuroxModalBase} from '@/components/aurox-modal-base';
import {toast} from 'sonner';
import Link from 'next/link';
import {Search,Truck,ClipboardCheck,Clock3,CheckCircle2,ChevronRight} from 'lucide-react';

type Processo={id:number;nome_lead?:string;placa?:string;modelo?:string;marca?:string;ano?:string;cor?:string;vendedor_display?:string;status?:string;gravame?:boolean;reconheceu_firma?:boolean;documento_pronto?:boolean;observacao?:string;ficha_id?:number;liberado?:boolean};
const ETAPAS:[keyof Processo,string][]=[['gravame','Gravame'],['reconheceu_firma','Reconhecimento de firma'],['documento_pronto','Documento pronto']];
const statuses=[['nao_iniciado','Não iniciado'],['em_andamento','Em andamento'],['concluido','Concluído']];
export default function ProcessosPage(){
 const {user}=useAuth(),qc=useQueryClient();const role=String(user?.tipo||'').toLowerCase();
 const canEdit=['admin','superadmin','gerente','documentista','documento'].includes(role);
 const superadmin=role==='superadmin';const [empresa,setEmpresa]=useState('');
 const empresas=useQuery({queryKey:['transferencias-empresas'],queryFn:async()=>{const {data}=await api.get('/faturamento/empresas');return Array.isArray(data)?data:[]},enabled:superadmin});
 const [search,setSearch]=useState(''),[pessoa,setPessoa]=useState<Processo|null>(null),[observacao,setObservacao]=useState(''),[status,setStatus]=useState('em_andamento'),[fields,setFields]=useState<Record<string,boolean>>({}),[busy,setBusy]=useState(false);
 const q=useQuery<Processo[]>({queryKey:['processos',superadmin?empresa:''],enabled:!!user&&(!superadmin||!!empresa),queryFn:async()=>{const {data}=await api.get('/processos',{params:superadmin?{empresa_id:Number(empresa)}:{}});return Array.isArray(data)?data:[]},refetchInterval:30000});
 const rows=q.data||[];const list=useMemo(()=>rows.filter(p=>[p.nome_lead,p.placa,p.marca,p.modelo].some(s=>String(s||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))),[rows,search]);
 const completed=rows.filter(p=>p.status==='concluido').length;
 const abrir=(p:Processo)=>{setPessoa(p);setObservacao(p.observacao||'');setStatus(p.status||'em_andamento');setFields(Object.fromEntries(ETAPAS.map(([k])=>[k,!!p[k]])))};
 async function salvar(e:FormEvent){e.preventDefault();if(!pessoa||!canEdit||busy)return;setBusy(true);try{await api.patch('/processos',{id:pessoa.id,status,observacao,...fields,...(superadmin?{empresa_id:Number(empresa)}:{})});toast.success('Transferência atualizada');setPessoa(null);await qc.invalidateQueries({queryKey:['processos']})}catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível salvar. Confira o vínculo e a tabela no banco.')}finally{setBusy(false)}}
 return <div className="studio-operational"><header className="studio-users-header"><div><span className="studio-eyebrow">Documentação automotiva</span><h1>Transferências</h1><p>Documentos dos veículos liberados pelo Faturamento, separados por empresa e loja.</p></div><Link href="/faturamento" className="studio-btn">Abrir Faturamento</Link></header>
 {superadmin&&<section className="studio-users-surface mb-4 p-4"><label className="studio-field">Empresa<select value={empresa} onChange={e=>setEmpresa(e.target.value)}><option value="">Selecione a empresa</option>{(empresas.data||[]).map((x:any)=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label></section>}
 <section className="studio-summary"><div><span className="studio-summary-icon"><Truck size={20}/></span><strong>{rows.length}</strong><small>Processos</small></div><div><span className="studio-summary-icon success"><CheckCircle2 size={20}/></span><strong>{completed}</strong><small>Concluídos</small></div><div><span className="studio-summary-icon warn"><Clock3 size={20}/></span><strong>{rows.length-completed}</strong><small>Em andamento</small></div></section>
 <section className="studio-users-surface"><div className="studio-users-tools"><div className="studio-users-search"><Search size={16}/><input placeholder="Cliente, placa ou veículo" aria-label="Buscar transferência" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
 {superadmin&&!empresa?<div className="studio-empty">Selecione uma empresa para visualizar transferências.</div>:q.isLoading?<div className="studio-empty">Carregando processos…</div>:q.isError?<div className="studio-error">Falha ao carregar Transferências: {(q.error as any)?.response?.data?.error||(q.error instanceof Error?q.error.message:'Confirme a migração SQL e os vínculos do banco')}.</div>:!list.length?<div className="studio-empty">Nenhum processo encontrado. Libere o veículo na lista ou no documento do Faturamento.</div>:<div className="studio-operational-list">{list.map(p=><button type="button" className="studio-operational-row" key={p.id} onClick={()=>abrir(p)}><span className="studio-operational-check"><ClipboardCheck size={18}/></span><span className="studio-operational-name"><strong>{p.nome_lead||`Processo #${p.id}`}</strong><small>{[p.marca,p.modelo,p.placa].filter(Boolean).join(' · ')} · {p.vendedor_display||'Responsável não informado'}</small></span><span className={'studio-status '+(p.status==='concluido'?'ok':'off')}>{statuses.find(([k])=>k===p.status)?.[1]||'Em andamento'}</span><ChevronRight size={17}/></button>)}</div>}
 </section>
 {pessoa&&<AuroxModalBase title={pessoa.nome_lead||'Transferência'} subtitle={[pessoa.marca,pessoa.modelo,pessoa.placa].filter(Boolean).join(' · ')} onClose={()=>setPessoa(null)} footer={<div className="studio-actions"><button type="button" className="studio-btn" onClick={()=>setPessoa(null)}>Fechar</button>{canEdit&&<button type="submit" className="studio-btn primary" form="studio-processo-form" disabled={busy}>Salvar alterações</button>}</div>}>
 <form id="studio-processo-form" onSubmit={salvar} className="studio-form-stack"><label className="studio-field">Status<select value={status} disabled={!canEdit} onChange={e=>setStatus(e.target.value)}>{statuses.map(([k,label])=><option key={k} value={k}>{label}</option>)}</select></label><div className="studio-form-stack">{ETAPAS.map(([key,label])=><label className="flex items-center gap-3 text-sm" key={key}><input className="h-4 w-4" type="checkbox" disabled={!canEdit} checked={!!fields[key]} onChange={e=>setFields(v=>({...v,[key]:e.target.checked}))}/>{label}</label>)}</div><label className="studio-field">Observação<textarea disabled={!canEdit} rows={5} maxLength={2000} value={observacao} onChange={e=>setObservacao(e.target.value)}/></label></form>
 </AuroxModalBase>}
 </div>
}
