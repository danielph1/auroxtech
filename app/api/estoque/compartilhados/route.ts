import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SEM_CACHE = { 'Cache-Control': 'private, no-store, max-age=0' };
const responder = (conteudo: unknown, status = 200) => NextResponse.json(conteudo, { status, headers: SEM_CACHE });

// Compartilhamento não concede administração do estoque da empresa de origem.
// Nenhuma coluna sensível, CPF, documento, contato ou detalhe interno é exposto.
const CARGOS_ESTOQUE = new Set(['superadmin', 'admin', 'gerente', 'marketing', 'vendedor']);
const ORDENS: Record<string, string> = {
  preco_asc: 's.preco ASC NULLS LAST, s.id DESC',
  preco_desc: 's.preco DESC NULLS LAST, s.id DESC',
  chegada_desc: 's.id DESC',
  chegada_asc: 's.id ASC',
  marca: 's.marca ASC NULLS LAST, s.modelo ASC NULLS LAST, s.id DESC',
};

type VeiculoParceiro = {
  id: number;
  origem_empresa_id: number;
  empresa_origem_nome: string;
  parceria_id: number;
  marca: string | null;
  modelo: string | null;
  ano: string | null;
  cor: string | null;
  km: number | null;
  carroceria: string | null;
  preco: number | null;
  status: string | null;
  patio: string | null;
  capa_url: string | null;
};

/** Busca apenas os dados comerciais autorizados. Não altera /api/estoque. */
export async function GET(req: NextRequest) {
  try {
    const usuario = await requireUser(req);
    if (!usuario) return responder({ error: 'Não autenticado' }, 401);
    const papel = String(usuario.tipo || '').toLowerCase();
    if (!CARGOS_ESTOQUE.has(papel)) return responder({ error: 'Sem permissão para consultar estoque' }, 403);

    const rawEmpresa = req.nextUrl.searchParams.get('empresa_id');
    const informada = rawEmpresa == null || rawEmpresa === '' ? 0 : Number(rawEmpresa);
    if (!Number.isSafeInteger(informada) || informada < 0) return responder({ error: 'Empresa inválida' }, 400);
    const propria = Number(usuario.empresa_id || 0);
    if (papel !== 'superadmin' && informada && informada !== propria)
      return responder({ error: 'Empresa fora do seu escopo' }, 403);
    // Superadmin deve escolher explicitamente a empresa receptora. Nunca consulta global.
    const empresaId = papel === 'superadmin' ? informada : propria;
    if (!Number.isSafeInteger(empresaId) || empresaId <= 0)
      return responder({ error: 'Selecione uma empresa receptora' }, 400);

    const rawPagina = req.nextUrl.searchParams.get('pagina') || '1';
    const pagina = Number(rawPagina);
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 1_000_000)
      return responder({ error: 'Página inválida' }, 400);
    const limite = 24;
    const busca = String(req.nextUrl.searchParams.get('busca') || '').trim().slice(0, 100) || null;
    const carroceria = String(req.nextUrl.searchParams.get('carroceria') || '').trim().toLowerCase();
    const categoria = carroceria && carroceria !== 'todas' ? carroceria.slice(0, 40) : null;
    const order = ORDENS[String(req.nextUrl.searchParams.get('ordem') || '')] || ORDENS.chegada_desc;

    // A parceria precisa permanecer aprovada, estar na direção correta e incluir estoque.
    // Não retorna dados de outras empresas apenas porque um ID é conhecido.
    const { rows } = await query<VeiculoParceiro>(
      `SELECT s.id, s.empresa_id AS origem_empresa_id,
              origem.nome AS empresa_origem_nome, p.id AS parceria_id,
              s.marca, s.modelo, s.ano, s.cor, s.km, s.carroceria,
              s.preco, s.status, s.patio,
              (SELECT f.url FROM public.estoque_fotos f
                 WHERE f.carro_id=s.id ORDER BY f.ordem, f.id LIMIT 1) AS capa_url
         FROM public.aurox_rede_parcerias p
         JOIN public.empresas origem ON origem.id=p.origem_empresa_id AND COALESCE(origem.ativo,TRUE)=TRUE
         JOIN public.empresas destino ON destino.id=p.destino_empresa_id AND COALESCE(destino.ativo,TRUE)=TRUE
         JOIN public.estoque_carros s ON s.empresa_id=p.origem_empresa_id
        WHERE p.destino_empresa_id=$1
          AND p.origem_empresa_id<>$1
          AND p.status='aprovada'
          AND p.compartilhar_estoque=TRUE
          AND COALESCE(s.status_estoque,'ativo')<>'inativo'
          AND ($2::text IS NULL OR CONCAT_WS(' ',s.marca,s.modelo,s.carro,s.cor,s.carroceria)
                ILIKE '%' || $2::text || '%')
          AND ($3::text IS NULL OR CONCAT_WS(' ',s.carroceria,s.marca,s.modelo,s.carro)
                ILIKE '%' || $3::text || '%')
        ORDER BY ${order}
        LIMIT $4::int OFFSET $5::int`,
      [empresaId, busca, categoria, limite + 1, (pagina - 1) * limite],
    );
    const mais = rows.length > limite;
    return responder({
      empresa_receptora_id: empresaId,
      pagina,
      proxima_pagina: mais ? pagina + 1 : null,
      registros: rows.slice(0, limite),
    });
  } catch (e) {
    console.error('[Aurox Estoque compartilhado]', e instanceof Error ? e.message : 'Falha na consulta');
    return responder({ error: 'Não foi possível consultar o estoque compartilhado' }, 503);
  }
}
