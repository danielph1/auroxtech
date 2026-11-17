'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Building2, CheckCircle2, ChevronRight, CircleHelp, Eye, EyeOff, MapPin, Plus, Power, PowerOff, Search, ShieldCheck, Store, Trash2, UsersRound, X } from 'lucide-react';
import './aurox-empresas-v4.css';

type LojaField = {codigo:string;nome:string;plano?:string};
type Empresa = {id:number;nome:string;slug?:string|null;ativo:boolean;qtd_lojas?:number;qtd_usuarios?:number;plano?:string};
type Detalhe = Empresa & {lojas?:Array<{id:number;codigo:string;nome:string;plano?:string;ativo:boolean}>;usuarios?:Array<{id:number;nome:string;login:string;tipo:string;status?:string;ativo:boolean}>};
const planos = ['vanguard','command','black'] as const;
const planoNome = (value?:string|null) => ({vanguard:'Vanguard',command:'Command',black:'Black'}[String(value||'').toLowerCase()] || 'Black');

export default function AuroxPage(){
 const {user} = useAuth();const qc=useQueryClient();const isSuper=String(user?.tipo||'').toLowerCase().trim()==='superadmin';
 const empresasQ=useQuery<Empresa[]>({queryKey:['aurox-empresas'],enabled:isSuper,queryFn:async()=> (await api.get('/aurox/empresas')).data as Empresa[]});
 const empresas=Array.isArray(empresasQ.data)?empresasQ.data:[];
 const [termo,setTermo]=useState('');const [status,setStatus]=useState<'todos'|'ativos'|'inativos'>('todos');
 const [selected,setSelected]=useState<number|null>(null);const [openNovo,setOpenNovo]=useState(false);
 const [form,setForm]=useState({nome:'',slug:'',admin_nome:'',admin_login:'',admin_senha:'',telefone:'',plano:'black'});
 const [lojas,setLojas]=useState<LojaField[]>([{codigo:'001',nome:'',plano:'black'}]);
 const [saving,setSaving]=useState(false);const [mostrarSenha,setMostrarSenha]=useState(false);
 const [confirm,setConfirm]=useState<{id:number;nome:string;ativo:boolean}|null>(null);
 const [senhaConfirm,setSenhaConfirm]=useState('');const [confirming,setConfirming]=useState(false);
 const [novaLoja,setNovaLoja]=useState({codigo:'',nome:'',plano:'black'});const [addLojaBusy,setAddLojaBusy]=useState(false);
 const detalheQ=useQuery<Detalhe>({queryKey:['aurox-empresa',selected],enabled:!!selected&&isSuper,queryFn:async()=> (await api.get(`/aurox/empresas/${selected}`)).data as Detalhe});
 const detalhe=detalheQ.data;
 const lista=useMemo(()=>empresas.filter(e=>{
  if(status==='ativos'&&!e.ativo)return false;if(status==='inativos'&&e.ativo)return false;
  const q=termo.trim().toLocaleLowerCase('pt-BR');return !q||`${e.nome} ${e.slug||''}`.toLocaleLowerCase('pt-BR').includes(q);
 }),[empresas,status,termo]);
 const resumo=useMemo(()=>({total:empresas.length,ativos:empresas.filter(e=>e.ativo).length,lojas:empresas.reduce((a,e)=>a+Number(e.qtd_lojas||0),0),usuarios:empresas.reduce((a,e)=>a+Number(e.qtd_usuarios||0),0)}),[empresas]);

 async function criarEmpresa(){
  if(!form.nome.trim()||!form.admin_login.trim()||!form.admin_senha||form.telefone.replace(/\D/g,'').length<10){toast.error('Informe o nome da empresa, o login e a senha do administrador.');return;}
  const lojasValidas=lojas.map(l=>({codigo:l.codigo.trim(),nome:(l.nome||l.codigo).trim(),plano:l.plano||form.plano||'black'})).filter(l=>l.codigo);
  if(!lojasValidas.length){toast.error('Adicione pelo menos uma loja.');return;}
  setSaving(true);
  try{
   const {data}=await api.post('/aurox/empresas',{nome:form.nome,slug:form.slug||undefined,telefone:form.telefone,plano:form.plano,lojas:lojasValidas,admin:{nome:form.admin_nome||form.admin_login,login:form.admin_login,senha:form.admin_senha}});
   toast.success(`Empresa criada: ${data.empresa?.nome||form.nome}`);
   setForm({nome:'',slug:'',admin_nome:'',admin_login:'',admin_senha:'',telefone:'',plano:'black'});
   setLojas([{codigo:'001',nome:'',plano:'black'}]);setMostrarSenha(false);setOpenNovo(false);
   await qc.invalidateQueries({queryKey:['aurox-empresas']});if(data.empresa?.id)setSelected(Number(data.empresa.id));
  }catch(e:any){toast.error(e?.response?.data?.error||'Não foi possível criar a empresa.');}
  finally{setSaving(false)}
 }
 async function confirmarToggle(){
  if(!confirm)return;if(!senhaConfirm){toast.error('Informe sua senha para continuar.');return;}
  setConfirming(true);
  try{
   await api.post('/aurox/confirm-senha',{senha:senhaConfirm});
   await api.patch(`/aurox/empresas/${confirm.id}`,{ativo:!confirm.ativo});
   toast.success(confirm.ativo?'Contrato desativado. Dados preservados.':'Contrato reativado.');
   const id=confirm.id;setConfirm(null);setSenhaConfirm('');
   await Promise.all([qc.invalidateQueries({queryKey:['aurox-empresas']}),qc.invalidateQueries({queryKey:['aurox-empresa',id]})]);
  }catch(e:any){toast.error(e?.response?.data?.error||'Senha incorreta ou erro ao atualizar contrato.');}
  finally{setConfirming(false)}
 }
 async function addLojaNaEmpresa(){
  if(!selected||!novaLoja.codigo.trim()){toast.error('Código da loja obrigatório.');return;}
  setAddLojaBusy(true);
  try{
   await api.post(`/aurox/empresas/${selected}`,{acao:'loja',codigo:novaLoja.codigo.trim(),nome:novaLoja.nome.trim()||novaLoja.codigo.trim(),plano:novaLoja.plano});
   toast.success('Loja adicionada.');setNovaLoja({codigo:'',nome:'',plano:'black'});
   await Promise.all([qc.invalidateQueries({queryKey:['aurox-empresa',selected]}),qc.invalidateQueries({queryKey:['aurox-empresas']})]);
  }catch(e:any){toast.error(e?.response?.data?.error||'Erro ao adicionar loja.');}
  finally{setAddLojaBusy(false)}
 }
 async function mudarPlano(lojaId:number,plano:string,codigo:string){
  if(!selected)return;
  try{await api.post(`/aurox/empresas/${selected}`,{acao:'plano_loja',loja_id:lojaId,plano});toast.success(`Plano da loja ${codigo}: ${planoNome(plano)}`);await qc.invalidateQueries({queryKey:['aurox-empresa',selected]});}
  catch(e:any){toast.error(e?.response?.data?.error||'Erro ao mudar plano.');}
 }
 if(!isSuper)return <main className="aurox-gestao-v4"><div className="aurox-v4-denied"><ShieldCheck size={27}/><h1>Área administrativa Aurox</h1><p>Esta seção está disponível exclusivamente para o superadmin da plataforma.</p><Link href="/inicio">Voltar à Visão Geral</Link></div></main>;
 return <main className="aurox-gestao-v4">
  <header className="aurox-v4-head"><div><div className="aurox-v4-eyebrow"><ShieldCheck size={14}/> ADMINISTRAÇÃO DA PLATAFORMA</div><h1>Gestão Aurox</h1><p>Contratos, concessionárias, lojas e acesso em um painel reservado à plataforma.</p></div>
   <Button type="button" onClick={()=>setOpenNovo(true)}><Plus size={17}/> Nova empresa</Button>
  </header>
  <section className="aurox-v4-summary" aria-label="Resumo da plataforma">
   <div><span className="aurox-v4-summary-icon"><Building2 size={20}/></span><small>Empresas cadastradas</small><strong>{empresasQ.isLoading?'…':resumo.total}</strong><span>Contratos registrados</span></div>
   <div><span className="aurox-v4-summary-icon green"><CheckCircle2 size={20}/></span><small>Contratos ativos</small><strong>{empresasQ.isLoading?'…':resumo.ativos}</strong><span>Com acesso habilitado</span></div>
   <div><span className="aurox-v4-summary-icon"><Store size={20}/></span><small>Lojas cadastradas</small><strong>{empresasQ.isLoading?'…':resumo.lojas}</strong><span>Em todas as empresas</span></div>
   <div><span className="aurox-v4-summary-icon"><UsersRound size={20}/></span><small>Usuários ativos</small><strong>{empresasQ.isLoading?'…':resumo.usuarios}</strong><span>Vinculados a empresas</span></div>
  </section>
  <div className="aurox-v4-grid">
   <section className="aurox-v4-list">
    <div className="aurox-v4-pane-head"><div><h2>Concessionárias</h2><p>Selecione uma empresa para ver lojas, planos e usuários.</p></div><span>{lista.length}</span></div>
    <div className="aurox-v4-filters"><div className="aurox-v4-search"><Search size={17}/><input aria-label="Pesquisar empresas" placeholder="Buscar empresa ou identificador" value={termo} onChange={e=>setTermo(e.target.value)}/></div><div className="aurox-v4-tabs"><button className={status==='todos'?'active':''} onClick={()=>setStatus('todos')}>Todas</button><button className={status==='ativos'?'active':''} onClick={()=>setStatus('ativos')}>Ativas</button><button className={status==='inativos'?'active':''} onClick={()=>setStatus('inativos')}>Inativas</button></div></div>
    <div className="aurox-v4-company-list">
     {empresasQ.isLoading?<p className="aurox-v4-placeholder">Carregando empresas…</p>:empresasQ.isError?<p className="aurox-v4-placeholder aurox-v4-error">Erro ao carregar empresas. Atualize a página.</p>:lista.length===0?<p className="aurox-v4-placeholder">Nenhuma empresa corresponde ao filtro.</p>:lista.map(e=><article className={`aurox-v4-company${selected===e.id?' selected':''}`} key={e.id}>
      <button className="aurox-v4-company-select" type="button" aria-current={selected===e.id?'true':undefined} onClick={()=>setSelected(e.id)}><span className="aurox-v4-company-avatar"><Building2 size={18}/></span><span className="aurox-v4-company-copy"><strong>{e.nome}</strong><small>{e.slug||'Sem identificador'}</small><span><Store size={13}/> {Number(e.qtd_lojas||0)} loja(s) <UsersRound size={13}/> {Number(e.qtd_usuarios||0)} usuário(s)</span></span><ChevronRight size={17}/></button>
      <div className="aurox-v4-company-actions"><span className={`aurox-v4-state${e.ativo?' on':' off'}`}>{e.ativo?'Ativa':'Inativa'}</span><button type="button" title={e.ativo?'Desativar contrato':'Reativar contrato'} aria-label={`${e.ativo?'Desativar':'Reativar'} ${e.nome}`} onClick={()=>{setConfirm({id:e.id,nome:e.nome,ativo:!!e.ativo});setSenhaConfirm('')}}>{e.ativo?<PowerOff size={15}/>:<Power size={15}/>}</button></div>
     </article>)}
    </div>
   </section>
   <section className="aurox-v4-detail">
    {!selected?<div className="aurox-v4-empty"><span><Building2 size={28}/></span><h2>Detalhes da empresa</h2><p>Selecione uma concessionária para gerenciar as lojas, consultar usuários e ajustar os planos contratados.</p></div>:detalheQ.isLoading?<p className="aurox-v4-placeholder">Carregando detalhes…</p>:detalheQ.isError||!detalhe?<p className="aurox-v4-placeholder aurox-v4-error">Falha ao carregar os detalhes desta empresa.</p>:<>
     <div className="aurox-v4-detail-head"><div><small>EMPRESA SELECIONADA</small><h2>{detalhe.nome}</h2><p>{detalhe.slug||'Identificador não informado'}</p></div><span className={`aurox-v4-state${detalhe.ativo?' on':' off'}`}>{detalhe.ativo?'Contrato ativo':'Contrato inativo'}</span></div>
     <div className="aurox-v4-detail-block"><div className="aurox-v4-block-head"><div><h3><Store size={17}/> Lojas e planos</h3><p>Os planos são aplicados por loja.</p></div><span>{detalhe.lojas?.length||0} loja(s)</span></div>
      <div className="aurox-v4-stores">{(detalhe.lojas||[]).map(l=><div className="aurox-v4-store" key={l.id}><span className="aurox-v4-store-icon"><Store size={17}/></span><div><strong>{l.nome||l.codigo}</strong><small>Código {l.codigo}{l.ativo===false?' · Inativa':''}</small></div><select aria-label={`Plano da loja ${l.codigo}`} value={String(l.plano||'black').toLowerCase()} onChange={e=>void mudarPlano(l.id,e.target.value,l.codigo)}>{planos.map(p=><option key={p} value={p}>{planoNome(p)}</option>)}</select></div>)}
       {(detalhe.lojas||[]).length===0&&<p className="aurox-v4-muted">Nenhuma loja vinculada.</p>}</div>
      <div className="aurox-v4-add-store"><h4>Adicionar loja</h4><div><label><span>Código *</span><Input placeholder="381" value={novaLoja.codigo} onChange={e=>setNovaLoja({...novaLoja,codigo:e.target.value})}/></label><label><span>Nome</span><Input placeholder="Unidade" value={novaLoja.nome} onChange={e=>setNovaLoja({...novaLoja,nome:e.target.value})}/></label><label><span>Plano</span><select value={novaLoja.plano} onChange={e=>setNovaLoja({...novaLoja,plano:e.target.value})}>{planos.map(p=><option key={p} value={p}>{planoNome(p)}</option>)}</select></label><Button type="button" onClick={addLojaNaEmpresa} disabled={addLojaBusy||!novaLoja.codigo.trim()}><Plus size={15}/>{addLojaBusy?'Adicionando…':'Adicionar'}</Button></div></div>
     </div>
     <div className="aurox-v4-detail-block"><div className="aurox-v4-block-head"><div><h3><UsersRound size={17}/> Usuários vinculados</h3><p>Consulta de contas pertencentes a esta empresa.</p></div><span>{detalhe.usuarios?.length||0} usuário(s)</span></div>
      <div className="aurox-v4-users">{(detalhe.usuarios||[]).map(u=><div className="aurox-v4-user" key={u.id}><span className="aurox-v4-user-avatar">{String(u.nome||u.login||'?')[0].toUpperCase()}</span><div><strong>{u.nome||u.login}</strong><small>@{u.login} · {u.tipo}</small></div><span className={`aurox-v4-state${u.ativo?' on':' off'}`}>{u.status|| (u.ativo?'Ativo':'Inativo')}</span></div>)}
       {(detalhe.usuarios||[]).length===0&&<p className="aurox-v4-muted">Nenhum usuário vinculado.</p>}</div>
     </div>
    </>}
   </section>
  </div>
  <p className="aurox-v4-disclaimer"><ShieldCheck size={15}/> Desativar contrato bloqueia o acesso da empresa e preserva os registros. Essa ação exige sua senha.</p>

  {openNovo&&<div className="aurox-v4-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)setOpenNovo(false)}}><div className="aurox-v4-modal" role="dialog" aria-modal="true" aria-labelledby="aurox-v4-criar-title">
   <header><div><small>CADASTRO DA PLATAFORMA</small><h2 id="aurox-v4-criar-title">Nova empresa</h2><p>Crie o contrato, as lojas e o primeiro administrador de uma só vez.</p></div><button type="button" aria-label="Fechar" onClick={()=>setOpenNovo(false)} disabled={saving}><X size={19}/></button></header>
   <div className="aurox-v4-modal-body"><div className="aurox-v4-form-heading"><Building2 size={17}/> Dados da concessionária</div><div className="aurox-v4-form-grid"><label><span>Nome da empresa *</span><Input autoFocus value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})} placeholder="Ex.: Automóveis Centro"/></label><label><span>Identificador (opcional)</span><Input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="automoveis-centro"/></label><label><span>Telefone com DDD *</span><Input type="tel" inputMode="tel" autoComplete="tel" required value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} placeholder="(21) 99999-9999"/></label></div>
    <div className="aurox-v4-form-heading"><UsersRound size={17}/> Administrador inicial</div><div className="aurox-v4-form-grid"><label><span>Nome do administrador</span><Input value={form.admin_nome} onChange={e=>setForm({...form,admin_nome:e.target.value})} placeholder="Nome completo"/></label><label><span>Login do administrador *</span><Input value={form.admin_login} title="Use letras, números, ponto, hífen, @ ou _" onChange={e=>setForm({...form,admin_login:e.target.value})} autoCapitalize="none" placeholder="usuario.admin"/></label><label className="aurox-v4-full"><span>Senha inicial *</span><div className="aurox-v4-password"><Input type={mostrarSenha?'text':'password'} value={form.admin_senha} onChange={e=>setForm({...form,admin_senha:e.target.value})} autoComplete="new-password" placeholder="Mínimo de 8 caracteres"/><button type="button" aria-label={mostrarSenha?'Ocultar senha':'Mostrar senha'} onClick={()=>setMostrarSenha(v=>!v)}>{mostrarSenha?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label></div>
    <div className="aurox-v4-form-heading"><Store size={17}/> Lojas e contrato</div><div className="aurox-v4-form-grid"><label className="aurox-v4-full"><span>Plano inicial *</span><select value={form.plano} onChange={e=>{const p=e.target.value;setForm({...form,plano:p});setLojas(prev=>prev.map(l=>({...l,plano:p})))}}>{planos.map(p=><option key={p} value={p}>{planoNome(p)}</option>)}</select></label></div>
    <div className="aurox-v4-loja-modal-list">{lojas.map((l,index)=><div key={index}><label><span>Código *</span><Input value={l.codigo} onChange={e=>setLojas(prev=>prev.map((o,i)=>i===index?{...o,codigo:e.target.value}:o))} placeholder="381"/></label><label><span>Nome da loja</span><Input value={l.nome} onChange={e=>setLojas(prev=>prev.map((o,i)=>i===index?{...o,nome:e.target.value}:o))} placeholder="Unidade"/></label><label><span>Plano</span><select value={l.plano||form.plano} onChange={e=>setLojas(prev=>prev.map((o,i)=>i===index?{...o,plano:e.target.value}:o))}>{planos.map(p=><option key={p} value={p}>{planoNome(p)}</option>)}</select></label>{lojas.length>1&&<button type="button" aria-label={`Remover loja ${index+1}`} title="Remover loja" onClick={()=>setLojas(prev=>prev.filter((_,i)=>i!==index))}><Trash2 size={16}/></button>}</div>)}</div>
    <button type="button" className="aurox-v4-add-another" onClick={()=>setLojas(prev=>[...prev,{codigo:'',nome:'',plano:form.plano}])}><Plus size={16}/> Adicionar outra loja</button>
   </div><footer><Button variant="outline" onClick={()=>setOpenNovo(false)} disabled={saving}>Cancelar</Button><Button onClick={criarEmpresa} disabled={saving}>{saving?'Criando empresa…':'Criar empresa e acessos'}</Button></footer>
  </div></div>}
  {confirm&&<div className="aurox-v4-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!confirming)setConfirm(null)}}><div className="aurox-v4-modal aurox-v4-modal-small" role="dialog" aria-modal="true" aria-labelledby="aurox-v4-confirm-title">
   <header><div><small>CONTRATO E ACESSO</small><h2 id="aurox-v4-confirm-title">{confirm.ativo?'Desativar contrato?':'Reativar contrato?'}</h2><p><strong>{confirm.nome}</strong> — {confirm.ativo?'os funcionários perderão o acesso, mas os registros serão preservados.':'o acesso poderá ser restabelecido conforme os usuários ativos.'}</p></div><button type="button" aria-label="Fechar" onClick={()=>setConfirm(null)} disabled={confirming}><X size={19}/></button></header>
   <div className="aurox-v4-modal-body"><label className="aurox-v4-confirm-label"><span>Confirme com sua senha de superadmin</span><Input autoFocus type="password" autoComplete="current-password" value={senhaConfirm} onChange={e=>setSenhaConfirm(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void confirmarToggle()}} placeholder="Sua senha"/></label></div>
   <footer><Button variant="outline" onClick={()=>setConfirm(null)} disabled={confirming}>Cancelar</Button><Button onClick={confirmarToggle} disabled={confirming} variant={confirm.ativo?'destructive':'default'}>{confirming?'Confirmando…':confirm.ativo?'Desativar contrato':'Reativar contrato'}</Button></footer>
  </div></div>}
 </main>;
}
