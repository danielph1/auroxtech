'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, Pencil, Search, UserRound, Phone, Loader2, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useFavoritos } from '@/contexts/favoritos-context';
import { LeadEditDialog } from '@/components/lead-edit-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Lead } from '@/types';

export default function FavoritosPage() {
  const fav = useFavoritos();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Lead | null>(null);
  const { data: favoritos = [], isLoading, error } = useQuery<Lead[]>({
    queryKey: ['favoritos-detalhes', fav.ids.slice().sort((a,b) => a-b).join(',')],
    queryFn: async () => (await api.get('/favoritos/detalhes')).data,
    refetchOnWindowFocus: true,
  });
  const lista = useMemo(() => favoritos.filter(l => {
    const termo = busca.trim().toLowerCase();
    return !termo || [l.nome_lead, l.telefone, l.vendedor_nome, l.produto_interesse, String(l.id)]
      .some(v => String(v || '').toLowerCase().includes(termo));
  }), [favoritos, busca]);
  async function removerFavorito(id: number) {
    try {
      await fav.toggle(id);
      await qc.invalidateQueries({ queryKey: ['favoritos-detalhes'] });
    } catch { toast.error('Não foi possível atualizar o favorito'); }
  }
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-3 pb-24 pt-5 sm:px-6">
      <header className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Atendimento / Meus leads</div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Favoritos</h1>
        <p className="text-sm text-muted-foreground">Seus leads importantes, com acesso rápido à conversa e aos dados completos.</p>
      </header>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar nome, telefone, veículo ou vendedor" className="pl-9" aria-label="Pesquisar favoritos" />
        </div>
        <span className="text-sm text-muted-foreground">{lista.length} {lista.length === 1 ? 'favorito' : 'favoritos'}</span>
      </div>
      {isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando favoritos…</div>}
      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Não foi possível carregar os favoritos. Tente atualizar a página.</p>}
      {!isLoading && !error && !lista.length && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">{busca ? 'Nenhum favorito corresponde à busca.' : 'Nenhum lead favorito disponível para seu perfil.'}</div>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lista.map(lead => (
          <article key={lead.id} className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary" aria-hidden="true">{String(lead.nome_lead || '?').trim().slice(0,1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-foreground">{lead.nome_lead}</h2>
                <p className="text-xs text-muted-foreground">Lead #{lead.id} · {lead.vendedor_nome || 'Sem vendedor'}</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10" title="Remover dos favoritos" aria-label={`Remover ${lead.nome_lead} dos favoritos`} onClick={() => void removerFavorito(Number(lead.id))}><Heart className="size-5 fill-current" /></button>
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Phone className="size-4 shrink-0"/><span className="truncate">{lead.telefone || 'Telefone não informado'}</span></div>
              <div className="flex items-center gap-2"><UserRound className="size-4 shrink-0"/><span className="truncate">{lead.produto_interesse || 'Interesse não informado'}</span></div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => setSelecionado(lead)} className="gap-2"><Pencil className="size-4"/> Ver / editar</Button>
              <Button asChild size="sm" className="gap-2"><Link href={`/chat?lead=${lead.id}`}><MessageSquare className="size-4"/> Conversar</Link></Button>
              <Link href={`/painel?busca=${encodeURIComponent(String(lead.id))}`} className="col-span-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary">Abrir no painel <ArrowUpRight className="size-3"/></Link>
            </div>
          </article>
        ))}
      </div>
      <LeadEditDialog lead={selecionado} onClose={() => {setSelecionado(null); void qc.invalidateQueries({queryKey:['favoritos-detalhes']});}} />
    </main>
  );
}
