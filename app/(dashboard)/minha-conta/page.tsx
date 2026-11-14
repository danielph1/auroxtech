'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AuroxAvatarEditor } from '@/components/aurox-avatar-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { AuroxMeuRitmo } from '@/components/aurox-meu-ritmo';
import { ArrowUpRight, Camera, ChevronRight, CircleUserRound, Mail, MapPin, Pencil, Settings2, ShieldCheck, UserRound, X } from 'lucide-react';
import './perfil-aurox-v4.css';

export default function MinhaContaPage() {
  const [dados, setDados] = useState<any>({});
  const [login, setLogin] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [idioma, setIdioma] = useState('pt');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api.get('/conta').then(({ data }) => {
      const r = data || {};
      setDados(r);setLogin(r.login || '');setNome(r.nome || '');
      setTelefone(r.telefone || '');setEmail(r.email || '');setIdioma(r.idioma || 'pt');
    }).catch(() => toast.error('Não foi possível carregar seus dados.')).finally(() => setCarregando(false));
  }, []);

  function cancelar() {
    setNome(dados.nome || '');setTelefone(dados.telefone || '');setEmail(dados.email || '');setEditando(false);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api.patch('/conta', { telefone, email, nome, idioma });
      setDados((d:any) => ({...d, telefone, email, nome}));
      toast.success('Seus dados foram atualizados.');setEditando(false);
    } catch (e:any) { toast.error(e?.response?.data?.error || 'Erro ao salvar os dados.'); }
    finally { setSalvando(false); }
  }

  async function foto(file?:File) {
    if (!file) return;
    try {
      const fd = new FormData();fd.append('foto', file);
      const { data } = await api.post('/conta', fd);
      setDados((d:any) => ({ ...d, foto_url:data.foto_url }));
      toast.success('Foto atualizada.');
    } catch (e:any) { toast.error(e?.response?.data?.error || 'Não foi possível atualizar a foto.'); throw e; }
  }

  return <main className="perfil-aurox-v4">
    <header className="perfil-v4-header">
      <div><div className="perfil-v4-eyebrow"><CircleUserRound size={14}/> ÁREA PESSOAL</div>
        <h1>Minha conta</h1><p>Seus dados e seu progresso em um só lugar. Sem perder o foco na operação.</p></div>
      <Link href="/configuracoes" className="perfil-v4-settings"><Settings2 size={17}/> Configurações <ChevronRight size={15}/></Link>
    </header>
    <div className="perfil-v4-layout">
      <aside className="perfil-v4-side">
        <section className="perfil-v4-profile">
          <div className="perfil-v4-cover" aria-hidden="true"><span/><span/><span/></div>
          <div className="perfil-v4-person">
            <AuroxAvatarEditor fotoUrl={dados.foto_url} nome={nome||login} onSave={async file=>{await foto(file);}} />
            <h2>{nome || login || (carregando?'Carregando…':'Seu perfil')}</h2>
            <p>@{login || '—'}</p>
            <div className="perfil-v4-tags"><span><ShieldCheck size={13}/> {String(dados.tipo || 'Usuário').replace('_',' ')}</span>{dados.loja && <span><MapPin size={13}/> Loja {dados.loja}</span>}</div>
          </div>
          <div className="perfil-v4-meta"><div><UserRound size={15}/><span>Conta individual</span></div><p>Suas alterações não modificam o cadastro dos demais colaboradores.</p></div>
        </section>
        <section className="perfil-v4-edit">
          <div className="perfil-v4-section-title"><div><span>Dados pessoais</span><small>Informações da sua conta</small></div>
            {!editando && <button type="button" onClick={() => setEditando(true)}><Pencil size={15}/> Editar</button>}
          </div>
          <div className="perfil-v4-fields">
            <div><Label htmlFor="perfil-v4-nome">Nome</Label><Input id="perfil-v4-nome" value={nome} onChange={e=>setNome(e.target.value)} disabled={!editando || salvando}/></div>
            <div><Label htmlFor="perfil-v4-login">Usuário / login</Label><Input id="perfil-v4-login" value={login} disabled/><p>O login é protegido e não é alterado nesta tela.</p></div>
            <div><Label htmlFor="perfil-v4-telefone">Telefone</Label><Input id="perfil-v4-telefone" type="tel" inputMode="tel" value={telefone} placeholder="Número com DDD" onChange={e=>setTelefone(e.target.value)} disabled={!editando || salvando}/></div>
            <div><Label htmlFor="perfil-v4-email">E-mail</Label><Input id="perfil-v4-email" type="email" value={email} placeholder="seu@email.com" onChange={e=>setEmail(e.target.value)} disabled={!editando || salvando}/></div>
          </div>
          {editando && <div className="perfil-v4-actions"><Button type="button" variant="outline" onClick={cancelar} disabled={salvando}><X size={15}/> Cancelar</Button><Button type="button" onClick={salvar} disabled={salvando}>{salvando?'Salvando…':'Salvar alterações'}</Button></div>}
          <div className="perfil-v4-security"><Mail size={16}/><div><strong>Dados protegidos</strong><p>Nome, telefone e e-mail são atualizados somente na sua conta.</p></div></div>
        </section>
      </aside>
      <div className="perfil-v4-work">
        <AuroxMeuRitmo/>
        <div className="perfil-v4-bottom-link"><span>Precisa de uma visão completa da concessionária?</span><Link href="/inicio">Abrir Visão Geral <ArrowUpRight size={15}/></Link></div>
      </div>
    </div>
  </main>;
}
