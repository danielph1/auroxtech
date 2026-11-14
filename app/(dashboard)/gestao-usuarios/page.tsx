'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import Link from 'next/link';
import {useAuth} from '@/contexts/auth-context';
import {api} from '@/lib/api';
import {toast} from 'sonner';
import {AuroxModalBase} from '@/components/aurox-modal-base';
import {podeCriarCargo,podeGerenciarUsuarios,podeAdministrarConta} from '@/lib/hierarquia-usuarios';
import {ChevronRight,Eye,EyeOff,KeyRound,Mail,Plus,RefreshCw,Search,UserRound,Power} from 'lucide-react';


type Empresa={id:number;nome:string};type Loja={codigo:string;nome:string};
type Usuario={id:number;nome:string;login:string;email?:string|null;telefone?:string|null;cpf?:string|null;
 tipo:string;loja:string;ativo:boolean;empresa_id:number;vendedor_id?:number|null;foto_url?:string};
const TODOS:[string,string][]=[['admin','Administrador'],['gerente','Gerente'],['marketing','Marketing'],['documentista','Documentista'],['vendedor','Vendedor'],['mecanico','Mecânico'],['guariba','Guariba']];
const lbl=(r:string)=>TODOS.find(x=>x[0]===r)?.[1]||r;
const errorMessage=(e:any,fallback:string)=>e?.response?.data?.error||fallback;

export default function GestaoUsuarios(){
 const {user,isLoading}=useAuth();const papel=String(user?.tipo||'').toLowerCase();const superadmin=papel==='superadmin';
 const [empresa,setEmpresa]=useState(''),[empresas,setEmpresas]=useState<Empresa[]>([]),[lojas,setLojas]=useState<Loja[]>([]),[users,setUsers]=useState<Usuario[]>([]);
 const [loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[consultaErro,setConsultaErro]=useState('');
 const [busca,setBusca]=useState(''),[filtroCargo,setFiltroCargo]=useState(''),[filtroLoja,setFiltroLoja]=useState(''),[filtroStatus,setFiltroStatus]=useState('');
 const [novo,setNovo]=useState(false),[selecionado,setSelecionado]=useState<Usuario|null>(null),[editarEmail,setEditarEmail]=useState(false),[confirmar,setConfirmar]=useState(false);
 const [nome,setNome]=useState(''),[login,setLogin]=useState(''),[senha,setSenha]=useState(''),[verSenha,setVerSenha]=useState(false),[cargo,setCargo]=useState('vendedor'),[loja,setLoja]=useState('');
 const [novoEmail,setNovoEmail]=useState(''),[senhaAtor,setSenhaAtor]=useState('');
 const opcoes=useMemo(()=>TODOS.filter(([r])=>podeCriarCargo(papel,r)),[papel]);
 const carregar=useCallback(async()=>{
  setLoading(true);setConsultaErro('');
  try{const {data}=await api.get('/gestao-usuarios',{params:empresa?{empresa_id:Number(empresa)}:{}});
   const es=Array.isArray(data.empresas)?data.empresas as Empresa[]:[];const ls=Array.isArray(data.lojas)?data.lojas as Loja[]:[];
   setEmpresas(es);if(!empresa)setEmpresa(String(data.empresa_id||es[0]?.id||''));
   setLojas(ls);setUsers(Array.isArray(data.usuarios)?data.usuarios:[]);
   setLoja(old=>ls.some(l=>l.codigo===old)?old:ls[0]?.codigo||'');
  }catch(e:any){setConsultaErro(errorMessage(e,'Falha ao consultar usuários.'));}
  finally{setLoading(false);}
 },[empresa]);
 useEffect(()=>{if(!isLoading&&podeGerenciarUsuarios(papel))void carregar();},[carregar,isLoading,papel]);
 useEffect(()=>{if(opcoes.length&&!opcoes.some(x=>x[0]===cargo))setCargo(opcoes[0][0]);},[opcoes,cargo]);
 useEffect(()=>{const url=new URL(window.location.href);if(url.searchParams.get('novo')==='1'){setNovo(true);url.searchParams.delete('novo');window.history.replaceState(null,'',url.pathname+url.search);}},[]);
 useEffect(()=>{if(isLoading||!superadmin)return;const value=Number(new URL(window.location.href).searchParams.get('empresa_id'));if(Number.isSafeInteger(value)&&value>0)setEmpresa(String(value));},[isLoading,superadmin]);
 useEffect(()=>{const url=new URL(window.location.href),id=Number(url.searchParams.get('usuario'));
  if(id>0&&users.length){const found=users.find(v=>v.id===id);if(found){setSelecionado(found);url.searchParams.delete('usuario');url.searchParams.delete('editar');window.history.replaceState(null,'',url.pathname+url.search);}}
 },[users]);
 const lista=useMemo(()=>users.filter(u=>{
  const q=busca.trim().toLowerCase();return (!q||[u.nome,u.login,u.tipo,u.loja].some(x=>String(x||'').toLowerCase().includes(q)))&&(!filtroCargo||u.tipo===filtroCargo)&&(!filtroLoja||u.loja===filtroLoja)&&(!filtroStatus||(filtroStatus==='ativo'?u.ativo:!u.ativo));
 }),[users,busca,filtroCargo,filtroLoja,filtroStatus]);
 const cargos=useMemo(()=>Array.from(new Set(users.map(x=>x.tipo))).sort(),[users]);
 const lojasFiltro=useMemo(()=>Array.from(new Set(users.map(x=>x.loja).filter(Boolean))).sort(),[users]);
 const autorizado=(u:Usuario)=>podeAdministrarConta(papel,u.tipo)&&Number(u.id)!==Number(user?.id);
 async function cadastrar(e:FormEvent){e.preventDefault();if(busy)return;
  setBusy(true);try{await api.post('/gestao-usuarios',{nome:nome.trim(),login:login.trim(),senha,tipo:cargo,loja,empresa_id:Number(empresa)});
   toast.success('Usuário cadastrado.');setNovo(false);setNome('');setLogin('');setSenha('');await carregar();
  }catch(err:any){toast.error(errorMessage(err,'Não foi possível cadastrar usuário.'));}finally{setBusy(false);}
 }
 async function salvarEmail(e:FormEvent){e.preventDefault();if(!selecionado||!autorizado(selecionado)||busy)return;
  const v=novoEmail.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(v))return toast.error('Informe um e-mail válido.');
  setBusy(true);try{await api.patch('/gestao-usuarios/email',{id:selecionado.id,email:v});toast.success('E-mail atualizado.');setEditarEmail(false);setSelecionado({...selecionado,email:v});await carregar();}
  catch(err:any){toast.error(errorMessage(err,'Não foi possível editar o e-mail.'));}finally{setBusy(false);}
 }
 async function alterarAcesso(e:FormEvent){e.preventDefault();if(!selecionado||!autorizado(selecionado)||busy)return;
  if(!senhaAtor.trim())return toast.error('Confirme sua senha de acesso.');
  setBusy(true);try{
   // Revalidação da identidade na interface. A API de PATCH ainda NÃO exige essa prova no servidor.
   const {data}=await api.post('/auth/login',{login:user?.login,senha:senhaAtor});
   if(Number(data?.user?.id)!==Number(user?.id))throw Error('A confirmação não corresponde à sua conta.');
   await api.patch('/gestao-usuarios',{id:selecionado.id,ativo:!selecionado.ativo});
   toast.success(selecionado.ativo?'Acesso desativado. Histórico e leads preservados.':'Acesso reativado.');
   setSelecionado(null);setConfirmar(false);setSenhaAtor('');await carregar();
  }catch(err:any){toast.error(errorMessage(err,err instanceof Error?err.message:'Senha inválida ou operação não autorizada.'));}
  finally{setBusy(false);}
 }
 async function recuperarSenha(){if(!selecionado||!autorizado(selecionado))return;
  if(!selecionado.email)return toast.error('Cadastre o e-mail de recuperação antes.');
  if(!window.confirm('Solicitar recuperação de senha para '+selecionado.nome+'?'))return;
  setBusy(true);try{const {data}=await api.post('/auth/esqueci-senha',{login:selecionado.login});toast.message(data?.mensagem||'Solicitação enviada.');}
  catch(e:any){toast.error(errorMessage(e,'Serviço de recuperação indisponível.'));}finally{setBusy(false);}
 }
 if(isLoading)return <div className="studio-empty">Carregando sessão…</div>;
 if(!podeGerenciarUsuarios(papel))return <div className="studio-empty">Seu cargo não possui autorização para administrar contas.</div>;
 return <div className="studio-users-page">
  <header className="studio-users-header"><div><span className="studio-eyebrow">Pessoas e acessos</span><h1>Usuários</h1><p>Cadastre, localize e acompanhe os acessos da sua empresa com as permissões atuais.</p></div>
   <button type="button" className="studio-btn primary" onClick={()=>setNovo(true)} disabled={!opcoes.length}><Plus size={17}/>Adicionar usuário</button></header>
  <section className="studio-users-overview"><div><strong>{users.length}</strong><span>Usuários no escopo</span></div><div><strong>{users.filter(x=>x.ativo).length}</strong><span>Ativos</span></div><div><strong>{users.filter(x=>!x.ativo).length}</strong><span>Inativos</span></div></section>
  <section className="studio-users-surface"><div className="studio-users-tools"><div className="studio-users-search"><Search size={17}/><input aria-label="Buscar usuários" placeholder="Buscar por nome, login, loja ou cargo" value={busca} onChange={e=>setBusca(e.target.value)}/></div>
    {superadmin&&<select aria-label="Selecionar empresa" value={empresa} onChange={e=>{setEmpresa(e.target.value);setSelecionado(null);}}><option value="">Empresa</option>{empresas.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select>}
    <select aria-label="Filtrar cargo" value={filtroCargo} onChange={e=>setFiltroCargo(e.target.value)}><option value="">Todos os cargos</option>{cargos.map(c=><option key={c} value={c}>{lbl(c)}</option>)}</select>
    <select aria-label="Filtrar loja" value={filtroLoja} onChange={e=>setFiltroLoja(e.target.value)}><option value="">Todas as lojas</option>{lojasFiltro.map(c=><option key={c} value={c}>Loja {c}</option>)}</select>
    <select aria-label="Filtrar status" value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)}><option value="">Todos os status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select>
    <button className="studio-icon" onClick={()=>void carregar()} title="Atualizar lista" aria-label="Atualizar"><RefreshCw size={17}/></button></div>
    {consultaErro&&<div className="studio-error">{consultaErro}</div>}
    <div className="studio-users-list" role="list">
     <div className="studio-users-list-head"><span>Colaborador</span><span>Cargo</span><span>Loja</span><span>Situação</span><span/></div>
     {lista.map(u=><button type="button" role="listitem" className="studio-users-row" key={u.id} onClick={()=>{setSelecionado(u);setEditarEmail(false);}}><span className="studio-person"><span className="studio-avatar">{u.foto_url?<img alt="" src={u.foto_url}/>:u.nome?.[0]?.toUpperCase()}</span><span><strong>{u.nome}</strong><small>@{u.login}</small></span></span><span>{lbl(u.tipo)}</span><span>Loja {u.loja||'—'}</span><span><i className={'studio-status '+(u.ativo?'ok':'off')}>{u.ativo?'Ativo':'Inativo'}</i></span><ChevronRight size={17}/></button>)}
    </div>
    {!loading&&!lista.length&&<div className="studio-empty">Nenhum usuário encontrado neste filtro.</div>}
    {loading&&<div className="studio-empty">Atualizando usuários…</div>}
   </section>
  {novo&&<AuroxModalBase title="Adicionar usuário" eyebrow="Novo acesso" subtitle="A empresa e o cargo definem as permissões. Todos os campos exigidos continuam obrigatórios." onClose={()=>setNovo(false)}
    footer={<div className="studio-actions"><button className="studio-btn" onClick={()=>setNovo(false)}>Cancelar</button><button className="studio-btn primary" type="submit" form="studio-form-user" disabled={busy||!loja||!empresa||!opcoes.length}>{busy?'Salvando…':'Cadastrar usuário'}</button></div>}>
    <form id="studio-form-user" onSubmit={cadastrar} className="studio-form-grid">
     {superadmin?<label className="studio-field">Empresa *<select required value={empresa} onChange={e=>{setEmpresa(e.target.value);setLoja('');}}><option value="">Selecione</option>{empresas.map(x=><option key={x.id} value={x.id}>{x.nome}</option>)}</select></label>:<div className="studio-field"><span>Empresa</span><div className="studio-readonly">{empresas[0]?.nome||'Sua empresa'}</div></div>}
     <label className="studio-field">Loja *<select required value={loja} onChange={e=>setLoja(e.target.value)}><option value="">Selecione</option>{lojas.map(x=><option key={x.codigo} value={x.codigo}>{x.nome||x.codigo} ({x.codigo})</option>)}</select></label>
     <label className="studio-field">Nome completo *<input required minLength={2} maxLength={140} value={nome} placeholder="Nome do colaborador" onChange={e=>setNome(e.target.value)}/></label>
     <label className="studio-field">Usuário de acesso *<input required minLength={3} maxLength={80} autoComplete="off" value={login} placeholder="Ex.: joao.silva" onChange={e=>setLogin(e.target.value)}/></label>
     <label className="studio-field">Cargo *<select required value={cargo} onChange={e=>setCargo(e.target.value)}>{opcoes.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
     <label className="studio-field">Senha inicial *<div className="studio-password"><input required minLength={8} maxLength={150} autoComplete="new-password" type={verSenha?'text':'password'} value={senha} placeholder="Mínimo de 8 caracteres" onChange={e=>setSenha(e.target.value)}/><button type="button" onClick={()=>setVerSenha(v=>!v)} aria-label="Exibir senha">{verSenha?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
    </form><p className="studio-tip">CPF, telefone e e-mail são concluídos pelas ferramentas de perfil já existentes; a API atual não os aceita neste cadastro.</p>
   </AuroxModalBase>}
  {selecionado&&!confirmar&&<AuroxModalBase wide title={selecionado.nome} eyebrow="Perfil e acesso" subtitle={`Loja ${selecionado.loja||'—'} · ${lbl(selecionado.tipo)}`} onClose={()=>{setSelecionado(null);setEditarEmail(false);}}
   footer={<div className="studio-actions"><button className="studio-btn" onClick={()=>setSelecionado(null)}>Voltar à lista</button>{autorizado(selecionado)&&<button className={'studio-btn '+(selecionado.ativo?'danger':'')} onClick={()=>{setConfirmar(true);setSenhaAtor('')}}><Power size={16}/>{selecionado.ativo?'Desativar acesso':'Reativar acesso'}</button>}</div>}>
   <div className="studio-profile-grid"><aside className="studio-profile-identity"><span className="studio-avatar huge">{selecionado.nome?.[0]?.toUpperCase()}</span><h3>{selecionado.nome}</h3><small>@{selecionado.login}</small><i className={'studio-status '+(selecionado.ativo?'ok':'off')}>{selecionado.ativo?'Ativo':'Inativo'}</i><span className="studio-tip text-center">{lbl(selecionado.tipo)} · Loja {selecionado.loja}</span></aside>
    <div className="studio-profile-data"><h3>Informações do colaborador</h3><div className="studio-info-grid"><div className="studio-info"><small>Nome</small><strong>{selecionado.nome}</strong></div><div className="studio-info"><small>Usuário / login</small><strong>{selecionado.login}</strong></div>
      <div className="studio-info"><small>Cargo</small><strong>{lbl(selecionado.tipo)}</strong></div><div className="studio-info"><small>Loja</small><strong>{selecionado.loja||'—'}</strong></div>
      <div className="studio-info"><small>E-mail</small><strong>{selecionado.email||'Não disponível na consulta'}</strong></div>
      <div className="studio-info"><small>Telefone</small><strong>{selecionado.telefone||'Não disponível na consulta'}</strong></div>
      <div className="studio-info"><small>CPF</small><strong>{selecionado.cpf||'Não disponível na consulta'}</strong></div>
      <div className="studio-info"><small>Empresa</small><strong>{empresas.find(c=>Number(c.id)===Number(selecionado.empresa_id))?.nome||'Empresa vinculada'}</strong></div></div>
      <h3 className="studio-spaced-heading">Gerenciar conta</h3><div className="studio-actions"><button type="button" className="studio-btn" disabled={!autorizado(selecionado)} onClick={()=>{setNovoEmail(selecionado.email||'');setEditarEmail(true)}}><Mail size={16}/>Alterar e-mail</button>
        <button type="button" className="studio-btn" disabled={!autorizado(selecionado)||!selecionado.ativo} onClick={()=>void recuperarSenha()}><KeyRound size={16}/>Recuperar senha</button>
        <Link className="studio-btn" href="/minha-conta"><UserRound size={16}/>Meu perfil</Link></div>
      <p className="studio-tip">Para editar nome, login, CPF ou telefone de outra pessoa com segurança, ainda é necessário um endpoint administrativo específico. Os campos aparecem como consulta, sem inventar dados.</p>
    </div></div>
   </AuroxModalBase>}
  {selecionado&&editarEmail&&!confirmar&&<AuroxModalBase title="Alterar e-mail" eyebrow={selecionado.nome} onClose={()=>setEditarEmail(false)} footer={<div className="studio-actions"><button className="studio-btn" onClick={()=>setEditarEmail(false)}>Cancelar</button><button className="studio-btn primary" type="submit" form="studio-email" disabled={busy}>Salvar e-mail</button></div>}>
   <form id="studio-email" onSubmit={salvarEmail}><label className="studio-field">E-mail de recuperação<input type="email" autoFocus required value={novoEmail} placeholder="colaborador@empresa.com" onChange={e=>setNovoEmail(e.target.value)}/></label></form>
  </AuroxModalBase>}
  {selecionado&&confirmar&&<AuroxModalBase title={selecionado.ativo?'Desativar acesso':'Reativar acesso'} eyebrow="Confirmação" subtitle={`Conta: ${selecionado.nome}`} onClose={()=>{setConfirmar(false);setSenhaAtor('')}} footer={<div className="studio-actions"><button className="studio-btn" onClick={()=>{setConfirmar(false);setSenhaAtor('')}}>Cancelar</button><button className={'studio-btn '+(selecionado.ativo?'danger':'primary')} disabled={!senhaAtor||busy} type="submit" form="studio-identity">{busy?'Verificando…':selecionado.ativo?'Confirmar desativação':'Confirmar reativação'}</button></div>}>
   <form id="studio-identity" onSubmit={alterarAcesso} className="space-y-4"><p className="text-sm text-muted-foreground">A conta será {selecionado.ativo?'desativada, sem excluir vendas, leads ou histórico':'reativada'}. Somente quem possui nível superior pode concluir esta operação.</p>
     <label className="studio-field">Sua senha atual<input type="password" autoComplete="current-password" autoFocus required value={senhaAtor} placeholder="Confirme sua identidade" onChange={e=>setSenhaAtor(e.target.value)}/></label>
     <p className="studio-tip">A senha é confirmada com o login existente, mas a API de alteração não impõe essa confirmação no servidor. Desligamento definitivo exige uma regra de segurança no backend.</p>
   </form>
  </AuroxModalBase>}
 </div>;
}
