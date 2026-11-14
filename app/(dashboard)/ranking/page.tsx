'use client';
import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {AuroxModalBase} from '@/components/aurox-modal-base';
import {Search,Trophy,Medal,BarChart3,ChevronRight} from 'lucide-react';

type Pessoa={id:number;nome:string;loja?:string;vendas?:number;rank?:string};
const N=(n:unknown)=>Number(n||0).toLocaleString('pt-BR');
export default function RankingPage(){
 const [search,setSearch]=useState(''),[pessoa,setPessoa]=useState<Pessoa|null>(null);
 const q=useQuery<Pessoa[]>({queryKey:['ranking'],queryFn:async()=>{const r=await api.get('/ranking');return Array.isArray(r.data)?r.data:[]},refetchInterval:60000});
 const list=useMemo(()=>(q.data||[]).filter(x=>[x.nome,x.loja,x.rank].some(v=>String(v||'').toLowerCase().includes(search.trim().toLowerCase()))),[q.data,search]);
 return <div className="studio-operational"><header className="studio-users-header"><div><span className="studio-eyebrow">Resultados da equipe</span><h1>Ranking</h1><p>Vendas registradas no CRM. Visualize o desempenho sem misturar dados de empresas.</p></div></header>
 <section className="studio-summary"><div><span className="studio-summary-icon"><Trophy size={20}/></span><strong>{q.data?.length||0}</strong><small>Colaboradores no ranking</small></div><div><span className="studio-summary-icon success"><Medal size={20}/></span><strong>{N(q.data?.reduce((a,p)=>a+Number(p.vendas||0),0))}</strong><small>Vendas registradas</small></div><div><span className="studio-summary-icon warn"><BarChart3 size={20}/></span><strong>{q.data?.[0]?.nome||'—'}</strong><small>Maior número de vendas</small></div></section>
 <section className="studio-users-surface"><div className="studio-users-tools"><div className="studio-users-search"><Search size={16}/><input aria-label="Pesquisar ranking" placeholder="Buscar colaborador ou loja" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
  {q.isLoading?<div className="studio-empty">Carregando ranking…</div>:q.isError?<div className="studio-error">Falha ao consultar ranking.</div>:!list.length?<div className="studio-empty">Nenhum resultado no recorte.</div>:<div className="studio-operational-list">{list.map((p,i)=><button type="button" key={p.id} onClick={()=>setPessoa(p)} className="studio-operational-row"><span className={'studio-rank-medal '+(i===0?'first':i===1?'second':i===2?'third':'')}><Medal size={18}/></span><span className="studio-operational-name"><strong>{p.nome}</strong><small>Loja {p.loja||'—'} · Categoria {p.rank||'Sem categoria'}</small></span><span><b>{N(p.vendas)}</b><small className="block text-xs text-muted-foreground">vendas</small></span><ChevronRight size={17}/></button>)}</div>}
 </section>
 {pessoa&&<AuroxModalBase title={pessoa.nome} subtitle={`Loja ${pessoa.loja||'—'}`} onClose={()=>setPessoa(null)} footer={<button className="studio-btn primary" onClick={()=>setPessoa(null)}>Concluir</button>}><section className="studio-summary" style={{marginBottom:0}}><div><span className="studio-summary-icon"><Medal size={18}/></span><strong>{pessoa.rank||'—'}</strong><small>Categoria</small></div><div><span className="studio-summary-icon success"><Trophy size={18}/></span><strong>{N(pessoa.vendas)}</strong><small>Vendas</small></div></section><p className="studio-tip">Os dados refletem a consulta de ranking do servidor, não estimativas inventadas pela interface.</p></AuroxModalBase>}
 </div>
}
