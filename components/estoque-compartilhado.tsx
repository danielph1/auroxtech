'use client';

import { useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { CarFront, Eye, LockKeyhole, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { api } from '@/lib/api';
import { AuroxModalBase } from '@/components/aurox-modal-base';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Ordem = 'preco_asc' | 'preco_desc' | 'chegada_desc' | 'chegada_asc' | 'marca';
type Empresa = { id: number; nome: string };
type Veiculo = {
  id: number; origem_empresa_id: number; empresa_origem_nome: string; parceria_id: number;
  marca: string | null; modelo: string | null; ano: string | null; cor: string | null;
  km: number | null; carroceria: string | null; preco: number | null;
  status: string | null; patio: string | null; capa_url: string | null;
};
type Pagina = {
  empresa_receptora_id: number; pagina: number; proxima_pagina: number | null; registros: Veiculo[];
};

const moeda = (v: number | null) => v == null ? 'Valor sob consulta' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v));
const texto = (valor: unknown) => String(valor ?? '').trim() || '—';
const permiteVer = new Set(['superadmin', 'admin', 'gerente', 'marketing', 'vendedor']);

/** Somente leitura: nenhuma chamada de edição ou upload é oferecida para carros de terceiros. */
export function EstoqueCompartilhado({ busca, carroceria, ordem }: {
  busca: string; carroceria: string; ordem: Ordem;
}) {
  const { user } = useAuth();
  const papel = String(user?.tipo || '').toLowerCase();
  const superadmin = papel === 'superadmin';
  const permitido = permiteVer.has(papel);
  const [empresaEscolhida, setEmpresaEscolhida] = useState('');
  const [selecionado, setSelecionado] = useState<Veiculo | null>(null);
  const empresas = useQuery<Empresa[]>({
    queryKey: ['aurox-estoque-parceiro-empresas'],
    enabled: superadmin,
    queryFn: async () => {
      const { data } = await api.get<Empresa[]>('/integracoes/empresas');
      return Array.isArray(data) ? data : [];
    },
  });
  const empresaReceptora = superadmin ? Number(empresaEscolhida || 0) : Number(user?.empresa_id || 0);

  const consulta = useInfiniteQuery<Pagina>({
    queryKey: ['aurox-estoque-compartilhado', empresaReceptora, busca, carroceria, ordem],
    enabled: permitido && empresaReceptora > 0,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<Pagina>('/estoque/compartilhados', {
        params: {
          empresa_id: empresaReceptora,
          pagina: Number(pageParam),
          busca: busca || undefined,
          carroceria,
          ordem,
        },
      });
      return data;
    },
    getNextPageParam: (ultima) => ultima.proxima_pagina || undefined,
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const veiculos = consulta.isError ? [] : (consulta.data?.pages.flatMap((p) => p.registros) || []);

  if (!permitido) return null;
  return (
    <section className="space-y-4" aria-labelledby="aurox-estoque-parceiro-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="aurox-estoque-parceiro-titulo" className="flex items-center gap-2 text-lg font-semibold">
            <CarFront className="h-5 w-5 text-primary" /> Estoque de parceiros
          </h2>
          <p className="text-xs text-muted-foreground">
            {veiculos.length} veículo(s) carregado(s) de empresas que autorizaram o compartilhamento.
            Somente leitura, sem transferência de propriedade.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => void consulta.refetch()}
          disabled={!empresaReceptora || consulta.isFetching}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      {superadmin && (
        <label className="block max-w-md space-y-1 text-sm">
          <span className="font-medium">Empresa receptora (superadmin)</span>
          <select value={empresaEscolhida} onChange={(e) => { setEmpresaEscolhida(e.target.value); setSelecionado(null); }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
            <option value="">Selecione a empresa para consultar as parcerias</option>
            {(empresas.data || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          {empresas.isError && <span className="block text-xs text-destructive">Não foi possível listar as empresas.</span>}
        </label>
      )}

      {!empresaReceptora ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          {superadmin ? 'Selecione uma empresa receptora para consultar seu estoque parceiro.' : 'Sua conta não possui empresa vinculada.'}
        </p>
      ) : consulta.isError ? (
        <p role="alert" className="rounded-xl border border-destructive/40 p-5 text-sm text-destructive">
          O estoque parceiro não pôde ser carregado. Confirme se a parceria está ativa ou tente atualizar.
        </p>
      ) : consulta.isLoading ? (
        <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">Consultando estoques autorizados…</p>
      ) : veiculos.length === 0 ? (
        <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
          Nenhum veículo compartilhado neste filtro. A empresa parceira precisa aprovar a categoria Estoque.
        </p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {veiculos.map((v) => (
              <Card key={`${v.origem_empresa_id}:${v.id}`} className="cursor-pointer transition hover:border-primary/50"
                onClick={() => setSelecionado(v)}>
                <CardContent className="space-y-3 p-5">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-muted">
                    <img src={v.capa_url || '/veiculo-preparacao.webp'} alt="" loading="lazy"
                      className="h-full w-full object-cover" />
                    <span className="absolute left-2 top-2 rounded-full border border-violet-400/30 bg-background/85 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">
                      Compartilhado
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CarFront className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <h3 className="min-w-0 text-base font-semibold">{texto(v.marca)} {texto(v.modelo)}</h3>
                  </div>
                  <p className="text-xs font-medium text-violet-500">Origem: {v.empresa_origem_nome}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Ano: <strong className="text-foreground">{texto(v.ano)}</strong></span>
                    <span>Cor: <strong className="text-foreground">{texto(v.cor)}</strong></span>
                    <span>KM: <strong className="text-foreground">{v.km == null ? '—' : Number(v.km).toLocaleString('pt-BR')}</strong></span>
                    <span>Pátio: <strong className="text-foreground">{texto(v.patio)}</strong></span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xl text-primary">{moeda(v.preco)}</strong>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" /> Ver</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {consulta.hasNextPage && (
            <div className="flex justify-center">
              <Button type="button" variant="outline" disabled={consulta.isFetchingNextPage}
                onClick={() => void consulta.fetchNextPage()}>
                {consulta.isFetchingNextPage ? 'Carregando…' : 'Carregar mais veículos parceiros'}
              </Button>
            </div>
          )}
        </>
      )}

      {selecionado && !consulta.isError && (
        <AuroxModalBase wide title={`${texto(selecionado.marca)} ${texto(selecionado.modelo)}`}
          eyebrow="ESTOQUE PARCEIRO · SOMENTE LEITURA"
          subtitle={`Veículo compartilhado por ${selecionado.empresa_origem_nome}`}
          onClose={() => setSelecionado(null)}>
          <div className="grid gap-5 md:grid-cols-[1.1fr_.9fr]">
            <img src={selecionado.capa_url || '/veiculo-preparacao.webp'} alt="Veículo compartilhado"
              className="w-full rounded-xl bg-muted object-cover aspect-[16/10]" />
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                A empresa proprietária mantém o controle. Você pode consultar, mas não editar, excluir,
                transferir nem anunciar este veículo pelo cadastro da outra concessionária.
              </p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Ano</dt><dd>{texto(selecionado.ano)}</dd></div>
                <div><dt className="text-muted-foreground">Cor</dt><dd>{texto(selecionado.cor)}</dd></div>
                <div><dt className="text-muted-foreground">KM</dt><dd>{selecionado.km == null ? '—' : Number(selecionado.km).toLocaleString('pt-BR')}</dd></div>
                <div><dt className="text-muted-foreground">Pátio</dt><dd>{texto(selecionado.patio)}</dd></div>
                <div><dt className="text-muted-foreground">Carroceria</dt><dd>{texto(selecionado.carroceria)}</dd></div>
                <div><dt className="text-muted-foreground">Status</dt><dd>{texto(selecionado.status)}</dd></div>
              </dl>
              <p className="text-lg font-semibold text-primary">{moeda(selecionado.preco)}</p>
            </div>
          </div>
        </AuroxModalBase>
      )}
    </section>
  );
}
