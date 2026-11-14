import { NextRequest, NextResponse } from 'next/server';
import { getPool, query } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  conviteValido, contextoParceria, hashConvite, noStore, novoCodigoConvite,
  numeroPositivo, papelParcerias,
} from '@/lib/parcerias';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resposta = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: noStore() });

export async function GET(req: NextRequest) {
  try {
    // Superadmin: lista empresas SOMENTE para escolher o escopo. Sem qualquer lead ou estoque.
    if (req.nextUrl.searchParams.get('listar_empresas') === '1') {
      const user = await requireUser(req);
      if (!user || String(user.tipo) !== 'superadmin') return resposta({ error: 'Sem permissão' }, 403);
      const { rows } = await query<{ id: number; nome: string }>(
        `SELECT id,nome FROM public.empresas WHERE COALESCE(ativo,TRUE) ORDER BY nome,id LIMIT 1000`,
      );
      return resposta(rows);
    }

    const ctx = await contextoParceria(req, req.nextUrl.searchParams.get('empresa_id'));
    if (!ctx.ok) return ctx.response;
    const empresaId = ctx.empresaId;
    const { rows: codigos } = await query<{ atualizado_em: string; expira_em: string; ativo: boolean }>(
      `SELECT atualizado_em, expira_em, (expira_em > now()) AS ativo
       FROM public.aurox_rede_codigos WHERE empresa_id=$1`, [empresaId],
    );
    // Nunca exibe codigo em texto puro: guardamos somente SHA-256 no banco.
    const { rows: parcerias } = await query(
      `SELECT p.id,p.origem_empresa_id,p.destino_empresa_id,p.compartilhar_leads,p.compartilhar_estoque,
        p.status,p.criado_em,p.aprovado_em,p.encerrado_em,
        CASE WHEN p.origem_empresa_id=$1 OR p.status='aprovada'
          THEN eo.nome ELSE NULL END AS origem_nome,
        ed.nome AS destino_nome
       FROM public.aurox_rede_parcerias p
       JOIN public.empresas eo ON eo.id=p.origem_empresa_id
       JOIN public.empresas ed ON ed.id=p.destino_empresa_id
       WHERE p.origem_empresa_id=$1 OR p.destino_empresa_id=$1
       ORDER BY CASE WHEN p.status='pendente' THEN 0 WHEN p.status='aprovada' THEN 1 ELSE 2 END,
         p.criado_em DESC LIMIT 150`, [empresaId],
    );
    const { rows: auditoria } = await query(
      `SELECT a.id,a.parceria_id,a.acao,a.criado_em
       FROM public.aurox_rede_auditoria a
       JOIN public.aurox_rede_parcerias p ON p.id=a.parceria_id
       WHERE p.origem_empresa_id=$1 OR p.destino_empresa_id=$1
       ORDER BY a.criado_em DESC LIMIT 25`, [empresaId],
    );
    return resposta({ empresa_id: empresaId, empresa_nome: ctx.empresaNome,
      codigo_gerado: codigos.length > 0, codigo_ativo: codigos[0]?.ativo === true,
      codigo_atualizado_em: codigos[0]?.atualizado_em ?? null,
      codigo_expira_em: codigos[0]?.expira_em ?? null,
      parcerias, auditoria });
  } catch (e) {
    console.error('[Aurox Rede GET]', e instanceof Error ? e.message : 'erro');
    return resposta({ error: 'Falha ao carregar a rede. Confira a migração SQL.' }, 503);
  }
}

type Acao = 'novo_codigo' | 'solicitar' | 'responder' | 'revogar';
export async function POST(req: NextRequest) {
  const size = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(size) && size > 8192) return resposta({ error: 'Solicitação muito grande' }, 413);
  let body: Record<string, unknown>;
  try {
    const b: unknown = await req.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) return resposta({ error: 'Dados inválidos' }, 400);
    body = b as Record<string, unknown>;
  } catch { return resposta({ error: 'JSON inválido' }, 400); }

  try {
    const ctx = await contextoParceria(req, body.empresa_id);
    if (!ctx.ok) return ctx.response;
    const { actor, empresaId } = ctx;
    const acao = String(body.acao || '') as Acao;
    if (!['novo_codigo','solicitar','responder','revogar'].includes(acao))
      return resposta({ error: 'Ação inválida' }, 400);

    if (acao === 'solicitar') {
      if (!conviteValido(body.codigo)) return resposta({ error: 'Código de convite inválido' }, 400);
      if (body.leads !== true && body.estoque !== true)
        return resposta({ error: 'Selecione ao menos um tipo de compartilhamento' }, 400);
    }
    if (acao === 'responder') {
      if (body.decisao !== 'aprovar' && body.decisao !== 'recusar') return resposta({ error: 'Decisão inválida' }, 400);
      if (body.decisao === 'aprovar' && body.leads !== true && body.estoque !== true)
        return resposta({ error: 'Selecione o que deseja aceitar' }, 400);
      if (body.decisao === 'aprovar' && body.leads === true && body.confirmacao_lgpd !== true)
        return resposta({ error: 'Como proprietária dos leads, confirme a responsabilidade LGPD antes de autorizar' }, 400);
    }
    if ((acao === 'responder' || acao === 'revogar') && !numeroPositivo(body.parceria_id))
      return resposta({ error: 'Parceria inválida' }, 400);

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      if (acao === 'novo_codigo') {
        const codigo = novoCodigoConvite();
        const { rows: novosCodigos } = await client.query<{ expira_em: string }>(
          `INSERT INTO public.aurox_rede_codigos(empresa_id,codigo_hash,gerado_por,expira_em)
           VALUES($1,$2,$3,now() + interval '24 hours')
           ON CONFLICT(empresa_id) DO UPDATE
           SET codigo_hash=EXCLUDED.codigo_hash,gerado_por=EXCLUDED.gerado_por,
               atualizado_em=now(),expira_em=now() + interval '24 hours'
           RETURNING expira_em`,
          [empresaId, hashConvite(codigo), actor.id],
        );
        await client.query(
          `INSERT INTO public.aurox_rede_auditoria(empresa_contexto_id,usuario_id,acao)
           VALUES($1,$2,'codigo_rotacionado')`, [empresaId, actor.id],
        );
        await client.query('COMMIT');
        // Código exibido somente agora; no banco fica exclusivamente o hash SHA-256.
        return resposta({ ok: true, codigo, expira_em: novosCodigos[0].expira_em });
      }

      if (acao === 'solicitar') {
        // Serializa convites de uma mesma empresa antes de avaliar o limite diario.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`aurox-rede-convite:${empresaId}`]);
        const codigo = conviteValido(body.codigo)!;
        const { rows: destinos } = await client.query<{ id: number }>(
          `SELECT e.id FROM public.aurox_rede_codigos c
           JOIN public.empresas e ON e.id=c.empresa_id
           WHERE c.codigo_hash=$1 AND c.expira_em > now() AND COALESCE(e.ativo,TRUE)=TRUE`, [hashConvite(codigo)],
        );
        const destinoId = destinos[0]?.id;
        if (!destinoId) { await client.query('ROLLBACK'); return resposta({ error: 'Código inexistente, substituído ou expirado (validade de 24 horas)' }, 404); }
        if (destinoId === empresaId) { await client.query('ROLLBACK'); return resposta({ error: 'Não é possível convidar a própria empresa' }, 400); }

        // Limita abuso mesmo quando um administrador possui muitos códigos válidos.
        const limite = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM public.aurox_rede_parcerias
           WHERE destino_empresa_id=$1 AND criado_em > now()-interval '24 hours'`, [empresaId],
        );
        if ((limite.rows[0]?.total || 0) >= 20) { await client.query('ROLLBACK'); return resposta({ error: 'Limite diário de convites atingido' }, 429); }
        const pendentes = await client.query<{ total: number }>(
          `SELECT count(*)::int AS total FROM public.aurox_rede_parcerias
           WHERE destino_empresa_id=$1 AND status='pendente'`, [empresaId],
        );
        if ((pendentes.rows[0]?.total || 0) >= 10) { await client.query('ROLLBACK'); return resposta({ error: 'Existem muitos convites aguardando resposta' }, 429); }
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO public.aurox_rede_parcerias
           (origem_empresa_id,destino_empresa_id,compartilhar_leads,compartilhar_estoque,
            confirmacao_lgpd,criado_por)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [destinoId, empresaId, body.leads === true, body.estoque === true,
           false, actor.id],
        );
        await client.query(
          `INSERT INTO public.aurox_rede_auditoria(parceria_id,empresa_contexto_id,usuario_id,acao)
           VALUES($1,$2,$3,'solicitada')`, [rows[0].id, empresaId, actor.id],
        );
        await client.query('COMMIT');
        // O solicitante A não acessa nenhum dado de B antes de B aprovar.
        return resposta({ ok: true, parceria_id: rows[0].id }, 201);
      }

      if (acao === 'responder') {
        const id = numeroPositivo(body.parceria_id);
        const decisao = body.decisao === 'aprovar' ? 'aprovada' : 'recusada';
        const leads = decisao === 'aprovada' && body.leads === true;
        const estoque = decisao === 'aprovada' && body.estoque === true;
        const { rows } = await client.query<{ id: number }>(
          `UPDATE public.aurox_rede_parcerias
           SET status=$3::text,compartilhar_leads=CASE WHEN $3::text='aprovada' THEN $4::boolean ELSE compartilhar_leads END,
            compartilhar_estoque=CASE WHEN $3::text='aprovada' THEN $5::boolean ELSE compartilhar_estoque END,
            confirmacao_lgpd=CASE WHEN $3::text='aprovada' THEN $7::boolean ELSE confirmacao_lgpd END,
            analisado_por=$6::bigint,atualizado_em=now(),
            aprovado_em=CASE WHEN $3::text='aprovada' THEN now() ELSE NULL END,
            encerrado_em=CASE WHEN $3::text='recusada' THEN now() ELSE NULL END
           WHERE id=$1 AND origem_empresa_id=$2 AND status='pendente'
             AND (NOT $4::boolean OR compartilhar_leads=TRUE)
             AND (NOT $5::boolean OR compartilhar_estoque=TRUE)
           RETURNING id`, [id,empresaId,decisao,leads,estoque,actor.id,body.confirmacao_lgpd === true],
        );
        if (!rows.length) { await client.query('ROLLBACK'); return resposta({ error: 'Solicitação não encontrada, já processada ou escopo inválido' }, 409); }
        await client.query(
          `INSERT INTO public.aurox_rede_auditoria(parceria_id,empresa_contexto_id,usuario_id,acao)
           VALUES($1,$2,$3,$4)`, [id,empresaId,actor.id,decisao],
        );
        await client.query('COMMIT');
        return resposta({ ok: true });
      }

      // Ambas as partes podem encerrar; nunca remove o dado original.
      const id = numeroPositivo(body.parceria_id);
      const { rows } = await client.query<{ id: number }>(
        `UPDATE public.aurox_rede_parcerias
         SET status='revogada',atualizado_em=now(),encerrado_em=now()
         WHERE id=$1 AND (origem_empresa_id=$2 OR destino_empresa_id=$2)
           AND status IN ('pendente','aprovada') RETURNING id`, [id,empresaId],
      );
      if (!rows.length) { await client.query('ROLLBACK'); return resposta({ error: 'Parceria não encontrada ou já encerrada' }, 409); }
      await client.query(
        `INSERT INTO public.aurox_rede_auditoria(parceria_id,empresa_contexto_id,usuario_id,acao)
         VALUES($1,$2,$3,'revogada')`, [id,empresaId,actor.id],
      );
      await client.query('COMMIT');
      return resposta({ ok: true });
    } catch (e: unknown) {
      await client.query('ROLLBACK').catch(() => undefined);
      if ((e as { code?: string })?.code === '23505') return resposta({ error: 'Já existe parceria pendente ou aprovada nesta direção' }, 409);
      if ((e as { code?: string })?.code === '23514') return resposta({ error: 'Compartilhamento não permitido pelos critérios de segurança' }, 400);
      throw e;
    } finally { client.release(); }
  } catch (e) {
    console.error('[Aurox Rede POST]', e instanceof Error ? e.message : 'erro');
    return resposta({ error: 'Não foi possível concluir a operação. Verifique a estrutura da Rede.' }, 503);
  }
}
