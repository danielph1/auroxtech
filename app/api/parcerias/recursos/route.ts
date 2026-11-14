import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { contextoParceria, noStore, numeroPositivo } from '@/lib/parcerias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const enviar = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore() });

/** Leitura direcional, paginada e expressamente AUTORIZADA. Nenhuma escrita nos recursos originais. */
export async function GET(req: NextRequest) {
  try {
    const ctx = await contextoParceria(req, req.nextUrl.searchParams.get('empresa_id'));
    if (!ctx.ok) return ctx.response;
    const parceriaId = numeroPositivo(req.nextUrl.searchParams.get('parceria_id'));
    const tipo = req.nextUrl.searchParams.get('tipo');
    if (!parceriaId || (tipo !== 'leads' && tipo !== 'estoque'))
      return enviar({ error: 'Parceria ou categoria inválida' }, 400);

    // A empresa RECEPTORA consulta apenas a ORIGEM previamente aprovada.
    // Um ID conhecido jamais substitui esta verificação em servidor.
    const p = await queryOne<{
      id: number; origem_empresa_id: number; destino_empresa_id: number;
      compartilhar_leads: boolean; compartilhar_estoque: boolean;
    }>(
      `SELECT p.id,p.origem_empresa_id,p.destino_empresa_id,
       p.compartilhar_leads,p.compartilhar_estoque
       FROM public.aurox_rede_parcerias p
       JOIN public.empresas eo ON eo.id=p.origem_empresa_id AND COALESCE(eo.ativo,TRUE)
       JOIN public.empresas ed ON ed.id=p.destino_empresa_id AND COALESCE(ed.ativo,TRUE)
       WHERE p.id=$1 AND p.destino_empresa_id=$2 AND p.status='aprovada'`,
      [parceriaId, ctx.empresaId],
    );
    if (!p) return enviar({ error: 'Parceria não encontrada para esta empresa' }, 404);
    if ((tipo === 'leads' && !p.compartilhar_leads) || (tipo === 'estoque' && !p.compartilhar_estoque))
      return enviar({ error: 'Este recurso não foi autorizado' }, 403);

    const pagina = Math.min(100, Math.max(1, numeroPositivo(req.nextUrl.searchParams.get('pagina')) || 1));
    const porPagina = 25;
    const offset = (pagina - 1) * porPagina;
    let black = false;
    if (tipo === 'leads') {
      // A checagem de possível número duplicado é benefício exclusivo do plano Black
      // da EMPRESA RECEPTORA; não revela outros registros nem altera deduplicação.
      const plano = await queryOne<{ black: boolean }>(
        `SELECT (
          EXISTS(SELECT 1 FROM public.lojas l WHERE l.empresa_id=$1
            AND COALESCE(l.ativo,TRUE)=TRUE AND LOWER(l.plano)='black')
          OR (NOT EXISTS(SELECT 1 FROM public.lojas l WHERE l.empresa_id=$1 AND COALESCE(l.ativo,TRUE)=TRUE)
            AND EXISTS(SELECT 1 FROM public.empresas e WHERE e.id=$1 AND LOWER(e.plano)='black'))
         ) AS black`, [ctx.empresaId],
      );
      black = !!plano?.black;
    }

    const evitarConflitos = tipo === 'leads' && black && req.nextUrl.searchParams.get('evitar_conflitos') === '1';
    let rows: Record<string, unknown>[];
    if (tipo === 'leads') {
      ({ rows } = await query<Record<string, unknown>>(
        `SELECT l.id,l.nome_lead,l.telefone,l.data_lead,
          COALESCE(l.respondeu,FALSE) AS respondeu,
          COALESCE(l.venda_concluida,FALSE) AS venda_concluida,
          CASE WHEN $3::boolean
            AND length(regexp_replace(COALESCE(l.telefone,''),'[^0-9]','','g'))>=10
            THEN EXISTS(
              SELECT 1 FROM public.leads local
              WHERE local.empresa_id=$2
                AND length(regexp_replace(COALESCE(local.telefone,''),'[^0-9]','','g'))>=10
                AND RIGHT(regexp_replace(COALESCE(local.telefone,''),'[^0-9]','','g'),11)=
                    RIGHT(regexp_replace(COALESCE(l.telefone,''),'[^0-9]','','g'),11)
            ) ELSE FALSE END AS possivel_conflito_numero
         FROM public.leads l
         WHERE l.empresa_id=$1
           AND (l.vendedor_id IS NULL OR EXISTS(
             SELECT 1 FROM public.vendedores v WHERE v.id=l.vendedor_id AND v.empresa_id=$1))
           AND (NOT $6::boolean OR
             length(regexp_replace(COALESCE(l.telefone,''),'[^0-9]','','g'))<10 OR
             NOT EXISTS (
               SELECT 1 FROM public.leads local WHERE local.empresa_id=$2
                 AND length(regexp_replace(COALESCE(local.telefone,''),'[^0-9]','','g'))>=10
                 AND RIGHT(regexp_replace(COALESCE(local.telefone,''),'[^0-9]','','g'),11)=
                     RIGHT(regexp_replace(COALESCE(l.telefone,''),'[^0-9]','','g'),11)
             ))
           AND EXISTS(SELECT 1 FROM public.aurox_rede_parcerias autorizado
             WHERE autorizado.id=$7 AND autorizado.status='aprovada'
               AND autorizado.origem_empresa_id=$1 AND autorizado.destino_empresa_id=$2
               AND autorizado.compartilhar_leads=TRUE)
         ORDER BY l.id DESC LIMIT $4 OFFSET $5`,
        [p.origem_empresa_id, ctx.empresaId, black, porPagina + 1, offset, evitarConflitos, parceriaId],
      ));
    } else {
      ({ rows } = await query<Record<string, unknown>>(
        `SELECT s.id,s.marca,s.modelo,s.ano,s.cor,s.km,s.carroceria,
          s.preco,s.status,s.patio,
          (SELECT f.url FROM public.estoque_fotos f
           WHERE f.carro_id=s.id ORDER BY f.ordem,f.id LIMIT 1) AS foto_url
         FROM public.estoque_carros s
         WHERE s.empresa_id=$1
           AND COALESCE(s.status_estoque,'ativo')<>'inativo'
           AND EXISTS(SELECT 1 FROM public.aurox_rede_parcerias autorizado
             WHERE autorizado.id=$4 AND autorizado.status='aprovada'
               AND autorizado.origem_empresa_id=$1 AND autorizado.destino_empresa_id=$5
               AND autorizado.compartilhar_estoque=TRUE)
         ORDER BY s.id DESC LIMIT $2 OFFSET $3`,
        [p.origem_empresa_id, porPagina + 1, offset, parceriaId, ctx.empresaId],
      ));
    }

    const temMais = rows.length > porPagina;
    const data = rows.slice(0, porPagina);
    // Auditoria de acesso ao recurso: somente IDs/contexto, nunca telefone ou CPF.
    await query(
      `INSERT INTO public.aurox_rede_auditoria
       (parceria_id,empresa_contexto_id,usuario_id,acao,detalhes)
       VALUES($1,$2,$3,'consulta', $4::jsonb)`,
      [parceriaId, ctx.empresaId, ctx.actor.id,
       JSON.stringify({ tipo, pagina, quantidade: data.length, evitar_conflitos: evitarConflitos })],
    );
    return enviar({ parceria_id: parceriaId, tipo, pagina,
      proxima_pagina: temMais ? pagina + 1 : null, black, evitando_conflitos: evitarConflitos, registros: data });
  } catch (e) {
    console.error('[Aurox Rede recursos]', e instanceof Error ? e.message : 'erro');
    return enviar({ error: 'Não foi possível carregar os registros autorizados.' }, 503);
  }
}
