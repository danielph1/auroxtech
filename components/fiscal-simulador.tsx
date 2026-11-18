'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {api} from '@/lib/api';
import {toast} from 'sonner';
import {Calculator,LockKeyhole,ReceiptText,ShieldCheck,Trash2} from 'lucide-react';

type Simulacao={id:string;descricao:string;regime:string;base:string;venda_centavos:string;
  base_calculo_centavos:string;aliquota_percentual:string;estimado_centavos:string;margem_centavos:string;criado_em:string};
const dinheiro=(c:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const input='w-full rounded-xl border border-border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
export function FiscalSimulador({empresaId}:{empresaId:number}){
 const [habilitado,setHabilitado]=useState<boolean|null>(null),[historico,setHistorico]=useState<Simulacao[]>([]);
 const [carregando,setCarregando]=useState(false),[enviando,setEnviando]=useState(false),[erro,setErro]=useState('');
 const [resultado,setResultado]=useState<{base_calculo_centavos:number;tributo_estimado_centavos:number;margem_apos_tributo_centavos:number}|null>(null);
 const [alvoExclusao,setAlvoExclusao]=useState<{id:string|null;descricao:string}|null>(null);
 const [senhaExclusao,setSenhaExclusao]=useState(''),[textoConfirmacao,setTextoConfirmacao]=useState(''),[excluindo,setExcluindo]=useState(false),[erroExclusao,setErroExclusao]=useState('');
 const [form,setForm]=useState({descricao:'',regime:'nao_informado',base:'receita_bruta',venda:'',aquisicao:'0',despesas:'0',base_manual:'',aliquota:''});
 async function consultar(){if(!empresaId)return;setCarregando(true);setErro('');
  try{const {data}=await api.get('/financas/fiscal',{params:{empresa_id:empresaId}});
   setHabilitado(Boolean(data.habilitado));setHistorico(Array.isArray(data.simulacoes)?data.simulacoes:[]);
  }catch(e:any){setErro(e?.response?.data?.error||'Não foi possível consultar o módulo');setHabilitado(null);}
  finally{setCarregando(false);}
 }
 useEffect(()=>{setResultado(null);setHabilitado(null);setHistorico([]);setAlvoExclusao(null);setSenhaExclusao('');if(empresaId)void consultar();},[empresaId]);
 async function salvar(e:FormEvent){e.preventDefault();if(enviando||!empresaId)return;
  if(form.aliquota.trim()==='')return toast.error('Informe a alíquota validada com sua contabilidade.');
  setEnviando(true);try{const {data}=await api.post('/financas/fiscal',{...form,empresa_id:empresaId});
    setResultado(data.resultado);toast.success('Simulação salva. Nenhum débito fiscal foi gerado.');await consultar();
  }catch(e:any){toast.error(e?.response?.data?.error||'Falha ao simular tributos');}finally{setEnviando(false);}
 }

 function abrirExclusao(id:string|null,descricao:string){
  setAlvoExclusao({id,descricao});setSenhaExclusao('');setTextoConfirmacao('');setErroExclusao('');
 }
 function fecharExclusao(){if(excluindo)return;setAlvoExclusao(null);setSenhaExclusao('');setErroExclusao('');}
 async function confirmarExclusao(e:FormEvent){
  e.preventDefault();if(!alvoExclusao||excluindo||!senhaExclusao)return;
  const todos=alvoExclusao.id===null;
  if(todos&&textoConfirmacao!=='APAGAR HISTORICO')return setErroExclusao('Digite APAGAR HISTORICO para confirmar.');
  setExcluindo(true);setErroExclusao('');
  try{
   const {data}=await api.delete('/financas/fiscal',{data:{
    empresa_id:empresaId,senha:senhaExclusao,
    ...(todos?{escopo:'todos',confirmacao:'APAGAR HISTORICO'}:{id:alvoExclusao.id}),
   }});
   fecharExclusao();setAlvoExclusao(null);setSenhaExclusao('');setTextoConfirmacao('');setResultado(null);
   toast.success(`${data?.removidas||0} simulação(ões) removida(s) do histórico. Auditoria preservada.`);
   await consultar();
  }catch(err:any){setErroExclusao(err?.response?.data?.error||'Não foi possível remover as simulações.');}
  finally{setExcluindo(false);}
 }
 return <section className="space-y-5" aria-label="Fiscal e Tributos">
  <header className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
   <span className="rounded-xl bg-primary/10 p-3 text-primary"><Calculator size={22}/></span><div><h2 className="text-xl font-semibold">Fiscal e Tributos</h2>
   <p className="mt-1 text-sm text-muted-foreground">Adicional do Financeiro · simulação gerencial, sem emissão de guia.</p></div>
  </header>
  {carregando&&<p className="text-sm text-muted-foreground">Consultando módulo Fiscal…</p>}
  {erro&&<p className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive" role="alert">{erro}</p>}
  {habilitado===false&&<div className="rounded-2xl border border-primary/30 bg-card p-6"><LockKeyhole className="mb-3 text-primary"/>
   <h3 className="text-lg font-semibold">Módulo adicional não contratado</h3>
   <p className="mt-2 text-sm text-muted-foreground">O administrador da plataforma pode habilitar Fiscal e Tributos no contrato desta empresa. Valor de referência: R$ 89,00/mês, somado aos outros serviços.</p></div>}
  {habilitado===true&&<>
   <form onSubmit={salvar} className="rounded-2xl border border-border bg-card p-5 space-y-5">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
     <label className="text-sm font-medium">Operação / identificação<input className={input+' mt-2'} value={form.descricao} maxLength={200} onChange={e=>setForm(v=>({...v,descricao:e.target.value}))} placeholder="Ex.: Veículo placa XYZ"/></label>
     <label className="text-sm font-medium">Regime da empresa<select className={input+' mt-2'} value={form.regime} onChange={e=>setForm(v=>({...v,regime:e.target.value,base:'receita_bruta'}))}>
      <option value="nao_informado">Não informado</option><option value="simples_nacional">Simples Nacional</option>
      <option value="lucro_presumido">Lucro presumido</option><option value="lucro_real">Lucro real</option></select></label>
     <label className="text-sm font-medium">Base do cálculo<select className={input+' mt-2'} value={form.base} onChange={e=>setForm(v=>({...v,base:e.target.value}))}>
      <option value="receita_bruta">Valor bruto da venda</option><option value="diferenca_venda_compra">Venda menos aquisição (somente quando aplicável)</option>
      <option value="manual">Base definida pela contabilidade</option></select></label>
     <label className="text-sm font-medium">Venda (R$)<input className={input+' mt-2'} value={form.venda} onChange={e=>setForm(v=>({...v,venda:e.target.value}))} placeholder="55000,00" inputMode="decimal" required/></label>
     <label className="text-sm font-medium">Aquisição (R$)<input className={input+' mt-2'} value={form.aquisicao} onChange={e=>setForm(v=>({...v,aquisicao:e.target.value}))} placeholder="48000,00" inputMode="decimal" required/></label>
     <label className="text-sm font-medium">Despesas da operação (R$)<input className={input+' mt-2'} value={form.despesas} onChange={e=>setForm(v=>({...v,despesas:e.target.value}))} placeholder="500,00" inputMode="decimal" required/></label>
     {form.base==='manual'&&<label className="text-sm font-medium">Base tributável contábil (R$)<input className={input+' mt-2'} value={form.base_manual} onChange={e=>setForm(v=>({...v,base_manual:e.target.value}))} placeholder="10000,00" inputMode="decimal" required/></label>}
     <label className="text-sm font-medium">Alíquota total efetiva (%)<input className={input+' mt-2'} value={form.aliquota} onChange={e=>setForm(v=>({...v,aliquota:e.target.value}))} placeholder="Ex.: 6,00" inputMode="decimal" required/></label>
    </div>
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-muted-foreground">
     A seleção do regime não aplica alíquotas automaticamente. Peça ao contador a base e a alíquota efetiva adequadas à operação. A opção “venda menos aquisição” não se aplica indistintamente a todas as revendas, consignações ou regimes. Esta simulação não calcula DAS, ICMS, IRPJ, CSLL nem a apuração oficial IBS/CBS.
    </div>
    <button type="submit" className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50" disabled={enviando}>{enviando?'Calculando…':'Calcular e salvar simulação'}</button>
   </form>
   {resultado&&<section className="grid gap-3 rounded-2xl border border-primary/25 bg-card p-5 sm:grid-cols-3" aria-live="polite">
    <div><small className="text-muted-foreground">Base adotada</small><p className="text-xl font-semibold">{dinheiro(resultado.base_calculo_centavos)}</p></div>
    <div><small className="text-muted-foreground">Tributos estimados</small><p className="text-xl font-semibold">{dinheiro(resultado.tributo_estimado_centavos)}</p></div>
    <div><small className="text-muted-foreground">Margem após estimativa</small><p className="text-xl font-semibold">{dinheiro(resultado.margem_apos_tributo_centavos)}</p></div>
   </section>}
   <section className="rounded-2xl border border-border bg-card p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><ReceiptText size={19}/>Histórico de simulações</h3>
     {historico.length>0&&<button type="button" className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10" onClick={()=>abrirExclusao(null,'Todo o histórico da empresa')}><Trash2 size={14}/>Limpar histórico</button>}
    </div>
    <p className="mt-1 mb-3 text-xs text-muted-foreground">Somente da empresa selecionada; não movimenta o caixa. Exclusões exigem sua senha e ficam registradas para auditoria.</p>
    {historico.length?<div className="space-y-2">{historico.map(s=><article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
      <span className="min-w-[130px]"><strong>{s.descricao||'Operação sem identificação'}</strong><small className="block text-muted-foreground">{new Date(s.criado_em).toLocaleDateString('pt-BR')}</small></span>
      <span>Venda: <b>{dinheiro(s.venda_centavos)}</b></span><span>Base: <b>{dinheiro(s.base_calculo_centavos)}</b></span><span>Estimativa: <b>{dinheiro(s.estimado_centavos)}</b></span>
      <button type="button" aria-label={`Excluir simulação ${s.descricao||s.id}`} title="Excluir com senha" onClick={()=>abrirExclusao(s.id,s.descricao||`Simulação #${s.id}`)} className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"><Trash2 size={14}/>Excluir</button>
     </article>)}</div>:<p className="text-sm text-muted-foreground">Nenhuma simulação cadastrada.</p>}
   </section>
   <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck size={15}/>Os valores são orientativos e precisam ser validados pela contabilidade antes de qualquer obrigação fiscal.</p>
  </>}

  {alvoExclusao&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)fecharExclusao();}}>
   <section role="dialog" aria-modal="true" aria-labelledby="aurox-fiscal-exclusao-titulo" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
    <h3 id="aurox-fiscal-exclusao-titulo" className="text-lg font-semibold">{alvoExclusao.id===null?'Limpar histórico fiscal':'Excluir simulação'}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{alvoExclusao.descricao}. A remoção afetará apenas a empresa selecionada. Os registros de auditoria serão preservados.</p>
    <form onSubmit={confirmarExclusao} className="mt-5 space-y-4">
     {alvoExclusao.id===null&&<label className="block text-sm font-medium">Digite APAGAR HISTORICO para confirmar
       <input className={input+' mt-2'} value={textoConfirmacao} onChange={e=>setTextoConfirmacao(e.target.value)} autoComplete="off" required/>
      </label>}
     <label className="block text-sm font-medium">Confirme sua senha de acesso
      <input className={input+' mt-2'} type="password" autoComplete="current-password" value={senhaExclusao} onChange={e=>setSenhaExclusao(e.target.value)} required minLength={1}/>
     </label>
     {erroExclusao&&<p role="alert" className="text-sm text-destructive">{erroExclusao}</p>}
     <div className="flex justify-end gap-3"><button type="button" onClick={fecharExclusao} disabled={excluindo} className="rounded-lg border border-border px-4 py-2 text-sm">Cancelar</button>
      <button type="submit" disabled={excluindo||!senhaExclusao||(alvoExclusao.id===null&&textoConfirmacao!=='APAGAR HISTORICO')} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"><Trash2 size={15}/>{excluindo?'Excluindo…':'Confirmar exclusão'}</button></div>
    </form>
   </section>
  </div>}
 </section>;
}
