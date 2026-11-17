'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {FileSpreadsheet,Upload,ArrowLeft,CheckCircle2,AlertTriangle,Loader2} from 'lucide-react';
import {useAuth} from '@/contexts/auth-context';
import {AuroxDriveFotos} from '@/components/aurox-drive-fotos';
import {api} from '@/lib/api';
import {toast} from 'sonner';

type Empresa={id:number;nome:string};
type Loja={codigo:string;nome:string};
type Resumo={ok:boolean;validos?:number;total?:number;ignorados:number;inseridos?:number;amostra?:Record<string,unknown>[];rejeitados?:{linha:number;motivo:string}[];aviso?:string};
const input='mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground';
export default function ImportacoesPlanilhas(){
 const router=useRouter();const {user,isLoading}=useAuth();
 const [tipo,setTipo]=useState<'leads'|'veiculos'>('leads');
 const [empresas,setEmpresas]=useState<Empresa[]>([]),[lojas,setLojas]=useState<Loja[]>([]);
 const [empresa,setEmpresa]=useState(''),[loja,setLoja]=useState('');
 const [arquivo,setArquivo]=useState<File|null>(null),[preview,setPreview]=useState<Resumo|null>(null);
 const [final,setFinal]=useState<Resumo|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const autorizado=['admin','superadmin','gerente','marketing','vendedor'].includes(String(user?.tipo||'').toLowerCase());
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('tipo')==='veiculos')setTipo('veiculos');},[]);
 useEffect(()=>{if(!autorizado)return;let active=true;
  api.get('/importacoes/planilha').then(r=>{if(!active)return;const emp=r.data?.empresas||[];setEmpresas(emp);setEmpresa(prev=>prev||String(emp.length===1?emp[0].id:''));})
   .catch(()=>toast.error('Não foi possível carregar as empresas.'))
   .finally(()=>{if(active)setLoading(false);});return()=>{active=false;};
 },[autorizado]);
 useEffect(()=>{setLojas([]);setLoja('');setPreview(null);setFinal(null);
  if(!empresa)return;let active=true;
  api.get('/lojas-opcoes',{params:{empresa_id:empresa}}).then(r=>{
   if(!active)return;const l=Array.isArray(r.data)?r.data:[];setLojas(l);
   if(l.length===1)setLoja(String(l[0].codigo));
  }).catch(()=>{});return()=>{active=false;};
 },[empresa]);
 const limpar=()=>{setPreview(null);setFinal(null);};
 async function enviar(acao:'preview'|'confirmar'){
  if(!arquivo||!empresa){toast.error('Escolha empresa e planilha.');return;}
  if(tipo==='veiculos'&&!loja){toast.error('Selecione uma loja padrão.');return;}
  const body=new FormData();body.append('arquivo',arquivo);body.append('empresa_id',empresa);
  body.append('tipo',tipo);body.append('acao',acao);body.append('loja',loja);
  setBusy(true);
  try{
   const {data}=await api.post('/importacoes/planilha',body,{timeout:120000});
   if(acao==='preview'){setPreview(data);setFinal(null);}
   else{setFinal(data);setPreview(null);toast.success(`${data.inseridos} registro(s) importado(s).`);}
  }catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível processar a planilha.');}
  finally{setBusy(false);}
 }
 if(isLoading||loading)return <div className="p-6 text-muted-foreground">Carregando importador…</div>;
 if(!autorizado)return <div className="p-6 text-muted-foreground">Importação disponível apenas para gestores autorizados.</div>;
 return <main className="mx-auto w-full max-w-5xl space-y-5 px-3 pb-14 sm:px-6">
  <button onClick={()=>router.back()} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/> Voltar</button>
  <div className="space-y-2"><div className="inline-flex items-center gap-2 text-sm font-semibold text-primary"><FileSpreadsheet size={18}/> Importação AUROX</div>
   <h1 className="text-2xl font-bold sm:text-3xl">Importar por planilha</h1>
   <p className="text-sm text-muted-foreground">Visualize os registros antes de confirmar. As linhas incompletas não interrompem as demais.</p></div>
  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-1.5">
   <button onClick={()=>{setTipo('leads');limpar();}} className={`rounded-lg px-2 py-3 text-sm font-medium ${tipo==='leads'?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>Leads → Triagem</button>
   <button disabled={String(user?.tipo).toLowerCase()==='vendedor'} onClick={()=>{setTipo('veiculos');limpar();}} className={`rounded-lg px-2 py-3 text-sm font-medium ${tipo==='veiculos'?'bg-primary text-primary-foreground':'hover:bg-muted'}`}>Veículos → Estoque</button>
  </div>
  <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4">
   <div className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-medium">Empresa proprietária
     <select className={input} value={empresa} onChange={e=>{setEmpresa(e.target.value);limpar();}} disabled={empresas.length===1}>
      <option value="">Selecione a empresa</option>{empresas.map(e=><option key={e.id} value={e.id}>{e.nome}</option>)}
     </select>
    </label>
    {tipo==='veiculos'&&<label className="text-sm font-medium">Loja padrão para veículos
      <select className={input} value={loja} onChange={e=>{setLoja(e.target.value);limpar();}}>
       <option value="">Selecione a loja</option>{lojas.map(l=><option key={l.codigo} value={l.codigo}>{l.nome} ({l.codigo})</option>)}
      </select></label>}
   </div>
   <label className="block rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-6 text-center cursor-pointer hover:bg-primary/10">
    <Upload className="mx-auto mb-2 h-7 w-7 text-primary"/><span className="block text-sm font-semibold">{arquivo?.name||'Selecionar planilha CSV ou XLSX'}</span>
    <span className="mt-1 block text-xs text-muted-foreground">Máximo 3 MB · Até 1.000 linhas · Sem envio automático de mensagens</span>
    <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={e=>{setArquivo(e.target.files?.[0]||null);limpar();}}/>
   </label>
   <div className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
     {tipo==='leads'?<><strong className="text-foreground">Obrigatórios: Nome e Telefone.</strong> Outros campos são opcionais. Sem telefone ou sem nome, a linha é ignorada. Telefones repetidos na planilha ou já existentes nesta empresa não entram de novo. Os registros entram na Triagem com origem <code>importacao-planilha</code>.</>
     :<><strong className="text-foreground">Obrigatórios: Marca, Modelo, Ano, Preço e loja.</strong> A placa é opcional; quando presente, será verificada contra duplicidades na mesma empresa. Fotos por placa serão associadas em fluxo separado.</>}
   </div>
   <button disabled={busy||!arquivo||!empresa||(tipo==='veiculos'&&!loja)} onClick={()=>void enviar('preview')}
    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
    {busy?<Loader2 className="animate-spin" size={17}/>:<FileSpreadsheet size={17}/>} Conferir planilha
   </button>
  </section>
  {preview&&<section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-lg">Prévia da importação</h2><span className="text-xs text-muted-foreground">Nenhum registro foi gravado ainda</span></div>
   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
    <div className="rounded-xl bg-muted/50 p-3"><div className="text-2xl font-bold">{preview.total}</div><div className="text-xs text-muted-foreground">Linhas</div></div>
    <div className="rounded-xl bg-primary/10 p-3"><div className="text-2xl font-bold">{preview.validos}</div><div className="text-xs text-muted-foreground">Prontas para importar</div></div>
    <div className="rounded-xl bg-muted/50 p-3"><div className="text-2xl font-bold">{preview.ignorados}</div><div className="text-xs text-muted-foreground">Ignoradas</div></div>
   </div>
   <div className="space-y-2"><h3 className="text-sm font-semibold">Amostra dos válidos</h3>
    <div className="max-h-60 space-y-2 overflow-y-auto">{preview.amostra?.map((r,i)=><div key={i} className="flex flex-wrap gap-3 rounded-lg border px-3 py-2 text-xs"><span className="font-semibold">{String(r.nome||[r.marca,r.modelo].filter(Boolean).join(' '))}</span><span>{String(r.telefone||r.placa||'Sem placa')}</span></div>)}
    {!preview.amostra?.length&&<p className="text-xs text-muted-foreground">Nenhum registro válido.</p>}</div></div>
   {!!preview.rejeitados?.length&&<details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold"><AlertTriangle className="mr-1 inline" size={15}/> Ver linhas ignoradas</summary>
    <div className="mt-2 max-h-48 overflow-auto space-y-1">{preview.rejeitados.map((r,i)=><p key={i} className="text-xs text-muted-foreground">Linha {r.linha}: {r.motivo}</p>)}</div></details>}
   <button disabled={!preview.validos||busy} onClick={()=>void enviar('confirmar')} className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy?'Importando…':`Confirmar importação de ${preview.validos} registro(s)`}</button>
  </section>}
  {tipo==='veiculos' && !!Number(empresa) && <AuroxDriveFotos empresaId={Number(empresa)}/>}
  {final&&<section className="space-y-3 rounded-2xl border border-primary/40 bg-card p-5">
   <div className="flex items-center gap-2 font-semibold"><CheckCircle2 size={21} className="text-primary"/> Importação concluída</div>
   <p className="text-sm">{final.inseridos} importado(s) · {final.ignorados} ignorado(s).</p><p className="text-xs text-muted-foreground">{final.aviso}</p>
   <Link href={tipo==='leads'?'/triagem':'/estoque'} className="inline-block rounded-lg border border-border px-4 py-2 text-sm">Abrir {tipo==='leads'?'triagem':'estoque'}</Link>
  </section>}
 </main>;
}
