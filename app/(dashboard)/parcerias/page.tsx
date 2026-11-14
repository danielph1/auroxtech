'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CarFront, Check,
  Copy, Handshake, KeyRound, LockKeyhole, RefreshCw, ShieldCheck, ShieldAlert,
  Users, X, RotateCcw,
} from 'lucide-react';
import './parcerias.css';

type Empresa = { id: number; nome: string };
type Parceria = {
  id: number; origem_empresa_id: number; destino_empresa_id: number;
  origem_nome: string | null; destino_nome: string;
  compartilhar_leads: boolean; compartilhar_estoque: boolean;
  status: 'pendente' | 'aprovada' | 'recusada' | 'revogada';
  criado_em: string; aprovado_em: string | null;
};
type Resumo = {
  empresa_id: number; empresa_nome: string; codigo_gerado: boolean; codigo_ativo: boolean;
  codigo_atualizado_em: string | null; codigo_expira_em: string | null;
  parcerias: Parceria[];
  auditoria: { id: number; parceria_id: number; acao: string; criado_em: string }[];
};
type Recurso = {
  parceria_id: number; tipo: 'leads' | 'estoque'; pagina: number;
  proxima_pagina: number | null; black: boolean; evitando_conflitos?: boolean;
  registros: Record<string, unknown>[];
};
const formatar = (x: unknown) => {
  const n = Number(x);
  return Number.isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
};
const dataFormatada = (x: unknown) => {
  if (!x) return '—';
  const d = new Date(String(x));
  return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString('pt-BR');
};
const mensagemErro = (e: unknown) => {
  const er = e as { response?: { data?: { error?: string } } } | undefined;
  return er?.response?.data?.error || 'Não foi possível concluir a operação';
};

export default function ParceriasPage() {
  const { user, isLoading } = useAuth();
  const papel = String(user?.tipo || '').toLowerCase();
  const superAdmin = papel === 'superadmin';
  const permitido = papel === 'admin' || superAdmin;
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [busy, setBusy] = useState('');
  const [codigoGerado, setCodigoGerado] = useState('');
  const [instante, setInstante] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setInstante(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  const [codigoOutro, setCodigoOutro] = useState('');
  const [enviaLeads, setEnviaLeads] = useState(false);
  const [enviaEstoque, setEnviaEstoque] = useState(true);
  const [declaracoesLgpd, setDeclaracoesLgpd] = useState<Record<number, boolean>>({});
  const [escolhas, setEscolhas] = useState<Record<number, { leads: boolean; estoque: boolean }>>({});
  const [recurso, setRecurso] = useState<Recurso | null>(null);
  const [parceriaAberta, setParceriaAberta] = useState<number | null>(null);
  const [tipoAberto, setTipoAberto] = useState<'leads' | 'estoque'>('estoque');
  const [evitarConflitos, setEvitarConflitos] = useState(false);
  const [confirmarRevogacao, setConfirmarRevogacao] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoading && permitido && !superAdmin) setEmpresaId(String(user?.empresa_id || ''));
  }, [isLoading, permitido, superAdmin, user?.empresa_id]);
  useEffect(() => {
    if (isLoading || !superAdmin) return;
    let vigente = true;
    api.get<Empresa[]>('/parcerias', { params: { listar_empresas: 1 } })
      .then(({ data }) => {
        if (!vigente) return;
        const lista = Array.isArray(data) ? data : [];
        setEmpresas(lista);
        setEmpresaId((atual) => lista.some(e => String(e.id) === atual) ? atual : String(lista[0]?.id || ''));
      })
      .catch(() => toast.error('Não foi possível carregar as empresas'));
    return () => { vigente = false; };
  }, [isLoading, superAdmin]);
  const carregar = useCallback(async (id: string) => {
    if (!id) return;
    const { data } = await api.get<Resumo>('/parcerias', { params: { empresa_id: id } });
    return data;
  }, []);
  useEffect(() => {
    setResumo(null);
    setCodigoGerado('');
    setRecurso(null);
    setParceriaAberta(null);
    setEscolhas({});
    setDeclaracoesLgpd({});
    setEvitarConflitos(false);
    if (!empresaId || !permitido) return;
    let vigente = true;
    carregar(empresaId).then((data) => { if (vigente && data) setResumo(data); })
      .catch(e => { if (vigente) toast.error(mensagemErro(e)); });
    return () => { vigente = false; };
  }, [empresaId, permitido, carregar]);

  const atualizar = async () => {
    if (!empresaId || busy) return;
    setBusy('atualizar');
    try { setResumo((await carregar(empresaId)) || null); }
    catch (e) { toast.error(mensagemErro(e)); }
    finally { setBusy(''); }
  };
  const executar = async (tipo: string, dados: Record<string, unknown>) => {
    if (!empresaId || busy) return null;
    setBusy(tipo);
    try {
      const { data } = await api.post<{ codigo?: string; ok: boolean }>('/parcerias', {
        ...dados, empresa_id: Number(empresaId),
      });
      setResumo((await carregar(empresaId)) || null);
      return data;
    } catch (e) { toast.error(mensagemErro(e)); return null; }
    finally { setBusy(''); }
  };
  const expiraEm = resumo?.codigo_expira_em ? new Date(resumo.codigo_expira_em).getTime() : 0;
  const codigoAtivo = !!resumo?.codigo_ativo && Number.isFinite(expiraEm) && expiraEm > instante;
  const restanteMs = codigoAtivo ? Math.max(0, expiraEm - instante) : 0;
  const restante = restanteMs < 60_000 ? 'menos de 1 minuto' :
    `${Math.floor(restanteMs / 3_600_000)}h ${String(Math.floor((restanteMs % 3_600_000) / 60_000)).padStart(2,'0')}min`;
  const criarCodigo = async () => {
    if (codigoAtivo && !window.confirm('O código atual ainda está válido. Gerar outro invalida imediatamente o anterior; as solicitações já enviadas e as parcerias aprovadas permanecem. Continuar?')) return;
    const data = await executar('codigo', { acao: 'novo_codigo' });
    if (data?.codigo) { setCodigoGerado(data.codigo); setInstante(Date.now()); toast.success('Código válido por 24 horas. Copie e compartilhe agora.'); }
  };
  const solicitar = async () => {
    const res = await executar('solicitar', {
      acao: 'solicitar', codigo: codigoOutro.trim(), leads: enviaLeads, estoque: enviaEstoque,
      confirmacao_lgpd: false,
    });
    if (res?.ok) { setCodigoOutro(''); toast.success('Solicitação enviada para aprovação'); }
  };
  const decidir = async (p: Parceria, decisao: 'aprovar' | 'recusar') => {
    const escolha = escolhas[p.id] || { leads: p.compartilhar_leads, estoque: p.compartilhar_estoque };
    const res = await executar(`decidir-${p.id}`, {
      acao: 'responder', parceria_id: p.id, decisao,
      leads: decisao === 'aprovar' && escolha.leads,
      estoque: decisao === 'aprovar' && escolha.estoque,
      confirmacao_lgpd: decisao === 'aprovar' && escolha.leads && declaracoesLgpd[p.id] === true,
    });
    if (res?.ok) toast.success(decisao === 'aprovar' ? 'Parceria aprovada' : 'Solicitação recusada');
  };
  const revogar = async (id: number) => {
    const res = await executar(`revogar-${id}`, { acao: 'revogar', parceria_id: id });
    if (res?.ok) {
      setConfirmarRevogacao(null);
      setRecurso(null);
      setParceriaAberta(null);
      toast.success('Acesso encerrado imediatamente');
    }
  };
  const consultar = async (parceriaId: number, tipo: 'leads' | 'estoque', pagina = 1, evitarOverride?: boolean) => {
    if (!empresaId || busy) return;
    setBusy('consultar');
    setParceriaAberta(parceriaId);
    setTipoAberto(tipo);
    setRecurso(null);
    try {
      const { data } = await api.get<Recurso>('/parcerias/recursos', {
        params: { empresa_id: empresaId, parceria_id: parceriaId, tipo, pagina, evitar_conflitos: (evitarOverride ?? evitarConflitos) ? 1 : 0 },
      });
      setRecurso(data);
    } catch (e) { toast.error(mensagemErro(e)); setParceriaAberta(null); }
    finally { setBusy(''); }
  };
  const copiar = async () => {
    if (!codigoAtivo || !codigoGerado) return;
    try { await navigator.clipboard.writeText(codigoGerado); toast.success('Código copiado'); }
    catch { toast.error('Copie o código manualmente'); }
  };

  // Origem=proprietaria B; destino=solicitante A.
  const pedidosRecebidos = useMemo(() => (resumo?.parcerias || []).filter(p => p.origem_empresa_id === Number(empresaId)), [resumo, empresaId]);
  const pedidosEnviados = useMemo(() => (resumo?.parcerias || []).filter(p => p.destino_empresa_id === Number(empresaId)), [resumo, empresaId]);
  const aguardando = pedidosRecebidos.filter(p => p.status === 'pendente');
  const recebendo = pedidosEnviados.filter(p => p.status === 'aprovada');
  const fornecendo = pedidosRecebidos.filter(p => p.status === 'aprovada');
  const pendentesEnviadas = pedidosEnviados.filter(p => p.status === 'pendente');

  if (!isLoading && !permitido) return <div className="arx-rede-restrito"><ShieldAlert size={30}/><h1>Acesso restrito</h1><p>Apenas admin e superadmin podem consultar e administrar a Rede Aurox.</p></div>;

  return <div className="arx-rede-page">
    <header className="arx-rede-head">
      <div className="arx-rede-heading">
        <div className="arx-rede-mark"><Handshake size={24}/></div>
        <div><span className="arx-rede-kicker">AUROX · CONEXÕES EMPRESARIAIS</span><h1>Rede de Parceiros</h1>
          <p>Compartilhe oportunidades comerciais com autorização — sem misturar empresas ou modificar seus registros.</p></div>
      </div>
      <button type="button" className="arx-rede-btn secondary" onClick={atualizar} disabled={!resumo || !!busy}><RefreshCw size={16}/>Atualizar</button>
    </header>

    {superAdmin && <div className="arx-rede-company"><label htmlFor="arx-rede-empresa">Empresa que você está administrando</label>
      <select id="arx-rede-empresa" value={empresaId} onChange={e => setEmpresaId(e.target.value)}>
        {empresas.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
      </select>
      <small>O superadmin precisa selecionar uma empresa. Nenhuma parceria concede acesso global.</small>
    </div>}
    {!resumo ? <div className="arx-rede-loading">{empresaId ? 'Carregando parcerias…' : 'Selecione uma empresa para começar.'}</div> : <>
      <section className="arx-rede-stats" aria-label="Resumo da rede">
        <div><span><ArrowDownLeft size={17}/> Recebendo dados</span><strong>{recebendo.length}</strong><small>Parcerias aprovadas para esta empresa</small></div>
        <div><span><ArrowUpRight size={17}/> Compartilhando dados</span><strong>{fornecendo.length}</strong><small>Empresas autorizadas a consultar nossos dados</small></div>
        <div><span><ShieldCheck size={17}/> Aprovação necessária</span><strong>{aguardando.length}</strong><small>Solicitações esperando sua decisão</small></div>
      </section>

      <div className="arx-rede-setup">
        <section className="arx-rede-card arx-rede-code">
          <div className="arx-rede-card-title"><div className="arx-rede-icon"><KeyRound size={19}/></div><div><h2>Código de convite</h2><p>Códigos temporários, válidos por 24 horas. O convite não concede acesso sem aprovação.</p></div></div>
          {codigoAtivo && codigoGerado ? <div className="arx-rede-secret"><code>{codigoGerado}</code><button onClick={copiar} type="button" aria-label="Copiar código"><Copy size={17}/></button></div> :
            <div className="arx-rede-hint">{codigoAtivo ? 'Existe um código válido, mas por segurança ele só aparece ao ser gerado. Gere outro para copiar um novo.' : 'Nenhum código válido no momento. Gere um convite para compartilhar.'}</div>}
          {codigoAtivo && <p className="arx-rede-footnote" role="status">Expira em {restante} · {new Date(expiraEm).toLocaleString('pt-BR')}</p>}
          <button type="button" className="arx-rede-btn secondary" onClick={criarCodigo} disabled={!!busy}><RotateCcw size={16}/>{codigoAtivo ? 'Substituir código atual' : 'Gerar código válido por 24h'}</button>
          <p className="arx-rede-footnote"><LockKeyhole size={14}/> Depois de 24h o código deixa de aceitar novos pedidos. Solicitações enviadas antes do vencimento continuam pendentes até análise.</p>
        </section>

        <section className="arx-rede-card">
          <div className="arx-rede-card-title"><div className="arx-rede-icon"><ArrowUpRight size={19}/></div><div><h2>Solicitar acesso a outra empresa</h2><p>Digite o código da empresa cujos dados você deseja consultar.</p></div></div>
          <label className="arx-rede-label" htmlFor="arx-rede-codigo-parceiro">Código de convite da empresa que fornecerá os dados</label>
          <input id="arx-rede-codigo-parceiro" className="arx-rede-input" value={codigoOutro} onChange={e => setCodigoOutro(e.target.value)} placeholder="ARX_…" autoComplete="off" spellCheck={false}/>
          <div className="arx-rede-checks">
            <label><input type="checkbox" checked={enviaLeads} onChange={e=>setEnviaLeads(e.target.checked)}/><Users size={17}/> Leads comerciais</label>
            <label><input type="checkbox" checked={enviaEstoque} onChange={e=>setEnviaEstoque(e.target.checked)}/><CarFront size={17}/> Veículos do estoque</label>
          </div>

          <button type="button" className="arx-rede-btn primary" disabled={!!busy || !codigoOutro.trim() || (!enviaLeads&&!enviaEstoque)} onClick={solicitar}>
            <ArrowRight size={16}/> Enviar solicitação
          </button>
          <p className="arx-rede-footnote">A empresa proprietária aprova antes de você consultar os recursos. Seus próprios dados não serão compartilhados.</p>
        </section>
      </div>

      <section className="arx-rede-card arx-rede-list">
        <div className="arx-rede-card-title"><div className="arx-rede-icon"><ShieldCheck size={19}/></div><div><h2>Solicitações para sua empresa</h2><p>Você decide quais dados da sua empresa serão disponibilizados a quem solicitou.</p></div></div>
        {aguardando.length === 0 ? <div className="arx-rede-empty">Nenhuma solicitação aguardando resposta.</div> :
          aguardando.map(p => {
            const e = escolhas[p.id] || { leads: p.compartilhar_leads, estoque: p.compartilhar_estoque };
            return <article className="arx-rede-entry" key={p.id}>
              <div><span className="arx-rede-entry-tag">Convite recebido · {dataFormatada(p.criado_em)}</span>
                <h3>{p.destino_nome}</h3><p>Esta empresa solicitou acesso aos seus dados. Escolha o que sua empresa autoriza disponibilizar.</p>
                <div className="arx-rede-checks small">
                  {p.compartilhar_leads && <label><input type="checkbox" checked={e.leads} onChange={ev=>setEscolhas(x=>({...x,[p.id]:{...e,leads:ev.target.checked}}))}/>Leads</label>}
                  {p.compartilhar_estoque && <label><input type="checkbox" checked={e.estoque} onChange={ev=>setEscolhas(x=>({...x,[p.id]:{...e,estoque:ev.target.checked}}))}/>Estoque</label>}
                </div>
                {e.leads && <label className="arx-rede-lgpd"><input type="checkbox" checked={declaracoesLgpd[p.id]===true} onChange={ev=>setDeclaracoesLgpd(x=>({...x,[p.id]:ev.target.checked}))}/><span>Como empresa proprietária, confirmo que temos base legal adequada para autorizar a consulta desses contatos pela solicitante.</span></label>}
              </div>
              <div className="arx-rede-entry-actions"><button type="button" className="arx-rede-btn primary" disabled={!!busy || (!e.leads&&!e.estoque) || (e.leads && !declaracoesLgpd[p.id])} onClick={()=>decidir(p,'aprovar')}><Check size={15}/>Aprovar</button>
                <button type="button" className="arx-rede-btn secondary" disabled={!!busy} onClick={()=>decidir(p,'recusar')}><X size={15}/>Recusar</button></div>
            </article>;
          })}
      </section>

      <div className="arx-rede-columns">
        <section className="arx-rede-card arx-rede-list">
          <div className="arx-rede-card-title"><div className="arx-rede-icon"><ArrowDownLeft size={19}/></div><div><h2>Dados recebidos</h2><p>Consulta somente leitura, autorizada pela empresa de origem.</p></div></div>
          {![...recebendo,...pendentesEnviadas].length ? <div className="arx-rede-empty">Ainda não há solicitações ou compartilhamentos aprovados para receber.</div> : [...recebendo,...pendentesEnviadas].map(p =>
            <article key={p.id} className="arx-rede-entry column">
              <div><span className={'arx-rede-entry-tag'+(p.status==='pendente'?' pending':'')}>{p.status==='pendente'?'Aguardando a aprovação do proprietário':'Parceria ativa'}</span><h3>{p.origem_nome || 'Empresa consultada'}</h3><p>{[p.compartilhar_leads?'Leads':null,p.compartilhar_estoque?'Estoque':null].filter(Boolean).join(' · ')}</p></div>
              <div className="arx-rede-entry-actions">
                {p.status==='aprovada' && p.compartilhar_leads && <button className="arx-rede-btn secondary" onClick={()=>consultar(p.id,'leads')} disabled={!!busy}><Users size={15}/>Ver leads</button>}
                {p.status==='aprovada' && p.compartilhar_estoque && <button className="arx-rede-btn secondary" onClick={()=>consultar(p.id,'estoque')} disabled={!!busy}><CarFront size={15}/>Ver estoque</button>}
                {confirmarRevogacao === p.id ? <><button className="arx-rede-btn danger" disabled={!!busy} onClick={()=>revogar(p.id)}>Confirmar cancelamento</button><button className="arx-rede-btn secondary" onClick={()=>setConfirmarRevogacao(null)}>Cancelar</button></> :
                  <button className="arx-rede-btn subtle" onClick={()=>setConfirmarRevogacao(p.id)}>{p.status==='pendente'?'Cancelar pedido':'Encerrar'}</button>}
              </div>
            </article>)}
        </section>
        <section className="arx-rede-card arx-rede-list">
          <div className="arx-rede-card-title"><div className="arx-rede-icon"><ArrowUpRight size={19}/></div><div><h2>Dados que compartilhamos</h2><p>Sua empresa continua proprietária de todos os dados autorizados.</p></div></div>
          {!fornecendo.length ? <div className="arx-rede-empty">Você ainda não autorizou outra empresa a consultar seus dados.</div> : fornecendo.map(p =>
            <article key={p.id} className="arx-rede-entry column">
              <div><span className={'arx-rede-entry-tag'+(p.status==='pendente'?' pending':'')}>{p.status==='pendente'?'Aguardando aprovação':'Compartilhamento ativo'}</span>
                <h3>{p.destino_nome}</h3><p>{[p.compartilhar_leads?'Leads':null,p.compartilhar_estoque?'Estoque':null].filter(Boolean).join(' · ')}</p></div>
              <div className="arx-rede-entry-actions">
                {confirmarRevogacao === p.id ? <><button className="arx-rede-btn danger" disabled={!!busy} onClick={()=>revogar(p.id)}>Confirmar</button><button className="arx-rede-btn secondary" onClick={()=>setConfirmarRevogacao(null)}>Cancelar</button></> :
                  <button className="arx-rede-btn subtle" onClick={()=>setConfirmarRevogacao(p.id)}>{p.status==='pendente'?'Cancelar convite':'Revogar acesso'}</button>}
              </div>
            </article>)}
        </section>
      </div>

      {parceriaAberta !== null && <section className="arx-rede-card arx-rede-results" aria-live="polite">
        <div className="arx-rede-result-head"><div><span className="arx-rede-kicker">CONSULTA AUTORIZADA · SOMENTE LEITURA</span>
          <h2>{tipoAberto==='leads'?'Leads compartilhados':'Veículos compartilhados'}</h2></div>
          <button type="button" className="arx-rede-btn secondary" onClick={()=>{setParceriaAberta(null);setRecurso(null)}}><X size={16}/>Fechar</button></div>
        {busy==='consultar' || !recurso ? <p>Carregando dados autorizados…</p> : <>
          {tipoAberto==='leads' && <><p className="arx-rede-footnote">Somente o plano Black detecta telefones semelhantes aos contatos da sua própria empresa. Isso não altera anúncios nem atribuições.</p>
            {recurso.black && <label className="arx-rede-lgpd"><input type="checkbox" checked={evitarConflitos} onChange={ev=>{setEvitarConflitos(ev.target.checked);void consultar(parceriaAberta!,'leads',1,ev.target.checked)}}/><span>Black · Ocultar leads com números já cadastrados na minha empresa (somente nesta consulta)</span></label>}</>}
          {recurso.registros.length ? <div className="arx-rede-resource-grid">{recurso.registros.map((item,i)=>
            <div className="arx-rede-resource" key={`${item.id}-${i}`}>
              {tipoAberto==='leads' ? <>
                <div className="arx-rede-resource-top"><Users size={18}/><strong>{String(item.nome_lead||'Lead sem nome')}</strong></div>
                <span className="arx-rede-resource-muted">Telefone: {String(item.telefone||'Não informado')}</span>
                <span className="arx-rede-resource-muted">Recebido: {dataFormatada(item.data_lead)}</span>
                {recurso.black && item.possivel_conflito_numero === true && <span className="arx-rede-conflict"><ShieldAlert size={14}/>Possível número duplicado na sua empresa</span>}
              </> : <>
                <div className="arx-rede-resource-top"><CarFront size={18}/><strong>{String(item.marca||'')} {String(item.modelo||'')}</strong></div>
                <span className="arx-rede-resource-muted">Ano {String(item.ano||'—')} · {String(item.cor||'—')} · {String(item.patio||'—')}</span>
                <strong className="arx-rede-price">{formatar(item.preco)}</strong>
              </>}
            </div>)}</div> : <div className="arx-rede-empty">Não há registros compartilhados nesta página.</div>}
          <div className="arx-rede-pages">
            <button type="button" className="arx-rede-btn secondary" disabled={!!busy || recurso.pagina<=1} onClick={()=>consultar(parceriaAberta!,tipoAberto,recurso.pagina-1)}>Anterior</button>
            <span>Página {recurso.pagina}</span>
            <button type="button" className="arx-rede-btn secondary" disabled={!!busy || !recurso.proxima_pagina} onClick={()=>consultar(parceriaAberta!,tipoAberto,recurso.proxima_pagina||1)}>Próxima</button>
          </div>
        </>}
      </section>}

      <aside className="arx-rede-security"><ShieldCheck size={20}/><div>
        <strong>Empresas permanecem isoladas.</strong>
        <p>Se A pedir acesso a B, B só libera seus próprios dados após aprovar; os dados de A não passam para B. Não são transferidos leads ou contas, nem publicados anúncios por outra empresa. Revogar bloqueia novas consultas. O compartilhamento de contatos exige base legal LGPD.</p>
      </div></aside>
    </>}
  </div>;
}
