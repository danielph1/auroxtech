'use client';
import {useEffect,useMemo,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/contexts/auth-context';
import {toast} from 'sonner';
import {ShieldCheck,RefreshCcw} from 'lucide-react';
type Regra={cargo?:string;usuario_id?:number;recurso:string;acao:string;permitido:boolean};
type Pessoa={id:number;nome:string;tipo:string};
type Data={empresa_id:number;recursos:Array<[string,string]>;acoes:string[];usuarios:Pessoa[];cargos:string[];regras_cargo:Regra[];regras_usuario:Regra[];acoes_por_recurso:Record<string,string[]>};
const acoesPt:Record<string,string>={visualizar:'Ver aba',criar:'Criar',editar:'Editar',excluir:'Excluir',enviar:'Enviar'};
export default function PermissoesPage(){
 const {user}=useAuth(),superadmin=user?.tipo==='superadmin',admin=user?.tipo==='admin';
 const [empresas,setEmpresas]=useState<Array<{id:number;nome:string}>>([]),[empresa,setEmpresa]=useState('');
 const [dados,setDados]=useState<Data|null>(null),[tipo,setTipo]=useState<'cargo'|'usuario'>('cargo');
 const [alvo,setAlvo]=useState(''),[busy,setBusy]=useState(''),[loading,setLoading]=useState(false),[erro,setErro]=useState('');
 const empresaId=superadmin?Number(empresa):Number(user?.empresa_id||0);
 useEffect(()=>{if(!superadmin)return;void api.get('/faturamento/empresas').then(r=>{const rows=Array.isArray(r.data)?r.data:[];
  setEmpresas(rows);setEmpresa(p=>p||String(rows[0]?.id||''));}).catch(()=>setErro('Não foi possível listar empresas'));},[superadmin]);
 async function carregar(){if(!empresaId)return;setLoading(true);setErro('');
  try{const {data}=await api.get('/permissoes',{params:{empresa_id:empresaId}});setDados(data);
   setAlvo(p=>p||String((tipo==='cargo'?data.cargos?.[0]:data.usuarios?.[0]?.id)||''));
  }catch(e:any){setDados(null);setErro(e?.response?.data?.error||'Falha ao carregar permissões');}
  finally{setLoading(false);}
 }
 useEffect(()=>{setDados(null);setAlvo('');if(empresaId&&(admin||superadmin))void carregar();},[empresaId,admin,superadmin]);
 useEffect(()=>setAlvo(String((tipo==='cargo'?dados?.cargos?.[0]:dados?.usuarios?.[0]?.id)||'')),[tipo,empresaId]);
 const regras=tipo==='cargo'?dados?.regras_cargo||[]:dados?.regras_usuario||[];
 const regra=(recurso:string,acao:string)=>regras.find(r=>r.recurso===recurso&&r.acao===acao&&(tipo==='cargo'?r.cargo===alvo:String(r.usuario_id)===alvo));
 async function salvar(recurso:string,acao:string,permitido:boolean|null){if(!empresaId||!alvo)return;
  const key=`${recurso}.${acao}`;setBusy(key);
  try{await api.put('/permissoes',{escopo:tipo,empresa_id:empresaId,...(tipo==='cargo'?{cargo:alvo}:{usuario_id:Number(alvo)}),recurso,acao,permitido});
   toast.success('Permissão atualizada.');await carregar();
  }catch(e:any){toast.error(e?.response?.data?.error||'Permissão não alterada');}finally{setBusy('');}
 }
 if(!admin&&!superadmin)return <section className="p-6">Somente administradores podem delegar permissões.</section>;
 return <main className="mx-auto max-w-6xl space-y-5 pb-24">
  <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Administração / Segurança</p><h1 className="mt-2 text-3xl font-semibold">Permissões da equipe</h1>
   <p className="mt-2 text-sm text-muted-foreground">Controle por cargo ou pessoa. Uma regra individual prevalece sobre a do cargo. Regras em branco usam a hierarquia padrão.</p></header>
  <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
   {superadmin&&<label className="text-sm">Empresa<select value={empresa} onChange={e=>setEmpresa(e.target.value)} className="ml-2 rounded-lg border bg-background p-2">{empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}</select></label>}
   <label className="text-sm">Tipo de regra<select value={tipo} onChange={e=>setTipo(e.target.value as 'cargo'|'usuario')} className="ml-2 rounded-lg border bg-background p-2"><option value="cargo">Por cargo</option><option value="usuario">Por usuário</option></select></label>
   <label className="text-sm">{tipo==='cargo'?'Cargo':'Usuário'}<select value={alvo} onChange={e=>setAlvo(e.target.value)} className="ml-2 rounded-lg border bg-background p-2">
    {tipo==='cargo'?(dados?.cargos||[]).map(c=><option key={c} value={c}>{c}</option>):(dados?.usuarios||[]).map(p=><option key={p.id} value={p.id}>{p.nome} · {p.tipo}</option>)}</select></label>
   <button type="button" className="ml-auto rounded-lg border p-2" onClick={()=>void carregar()} disabled={loading}><RefreshCcw size={17}/></button>
  </div>
  {erro&&<p role="alert" className="rounded-xl border border-destructive/50 p-4 text-sm text-destructive">{erro}</p>}
  {loading&&<p className="text-sm text-muted-foreground">Carregando…</p>}
  {dados&&alvo&&<section className="overflow-auto rounded-2xl border bg-card">
   <table className="min-w-[640px] w-full text-left text-sm"><thead><tr className="border-b bg-muted/20"><th className="p-3">Área</th>{dados.acoes.map(a=><th key={a} className="p-3">{acoesPt[a]||a}</th>)}</tr></thead><tbody>
    {dados.recursos.map(([id,nome])=><tr key={id} className="border-b last:border-0"><th className="p-3 font-medium">{nome}</th>{dados.acoes.map(acao=>{const r=regra(id,acao);return <td key={acao} className="p-2">
      {!dados.acoes_por_recurso?.[id]?.includes(acao)?<span className="block text-center text-muted-foreground/50">—</span>:
      <select aria-label={`${nome}: ${acoesPt[acao]}`} value={r?String(r.permitido):'padrao'} disabled={Boolean(busy)} onChange={e=>void salvar(id,acao,e.target.value==='padrao'?null:e.target.value==='true')}
       className="w-full rounded-lg border bg-background p-2 text-xs disabled:opacity-50"><option value="padrao">Padrão</option><option value="true">Permitir</option><option value="false">Bloquear</option></select>
     }
     </td>})}</tr>)}</tbody></table>
   </section>}
   <p className="flex items-start gap-2 rounded-xl border p-4 text-xs text-muted-foreground"><ShieldCheck size={17}/>
    Não é possível dar a um cargo acesso acima dos limites e permissões de origem. O administrador não pode alterar a si próprio ou outros administradores. As alterações são avaliadas no servidor sem atravessar empresas.</p>
 </main>;
}
