import { getPool, query } from '@/lib/db';
import { proximoVendedorId } from '@/lib/aurox-rodizio-sequencia';

export const runtimeRodizio = 'nodejs';
type Destino = { id: number; empresa_id: number };
type Triagem = {
  id: number; empresa_id: number; nome: string | null; telefone: string | null;
  email: string | null; interesse: string | null; mensagem: string | null; origem: string | null;
};

/**
 * Rodízio por empresa. Cada avanço é persistido na MESMA transação da criação
 * do lead. O POST manual da triagem não chama esta função e não altera o cursor.
 * Não depende de navegador aberto quando acionado pelo agendador do worker.
 */
export async function processarRodizioTriagem(empresaFiltro: number | null, limite = 20) {
  if (empresaFiltro !== null && (!Number.isSafeInteger(empresaFiltro) || empresaFiltro < 1))
    throw new Error('Empresa inválida para rodízio');
  const max = Math.max(1, Math.min(25, Math.trunc(limite)));
  const pool = getPool();
  const alvos = await pool.query<Destino>(`
    SELECT t.id, t.empresa_id
      FROM public.triagem t
      JOIN public.empresas e ON e.id=t.empresa_id AND COALESCE(e.ativo,FALSE)
     WHERE t.status='aguardando'
       AND t.empresa_id IS NOT NULL
       AND COALESCE(e.slug,'')<>'aurox-plataforma'
       AND t.created_at <= now() - interval '10 seconds'
       AND ($1::integer IS NULL OR t.empresa_id=$1)
       AND EXISTS (
         SELECT 1 FROM public.vendedores v
          WHERE v.empresa_id=t.empresa_id AND COALESCE(v.ativo,FALSE)
            AND EXISTS(SELECT 1 FROM public.usuarios u
              WHERE u.vendedor_id=v.id AND u.empresa_id=v.empresa_id
                AND LOWER(u.tipo)='vendedor' AND COALESCE(u.ativo,FALSE)
                AND LOWER(COALESCE(u.status,'ativo'))='ativo')
       )
     ORDER BY t.created_at, t.id LIMIT $2`, [empresaFiltro, max]);

  let atribuidos = 0, ignorados = 0, erros = 0;
  for (const alvo of alvos.rows) {
    const db = await pool.connect();
    let tx = false;
    let realizado: {leadId:number; triagemId:number; empresaId:number; origem:string; mensagem:string} | null = null;
    try {
      await db.query('BEGIN'); tx = true;
      // Se outro worker ou um atendente está atribuindo, não aguardar nem duplicar.
      const tri = await db.query<Triagem>(`
        SELECT t.id,t.empresa_id,t.nome,t.telefone,t.email,t.interesse,t.mensagem,t.origem
          FROM public.triagem t JOIN public.empresas e ON e.id=t.empresa_id
         WHERE t.id=$1 AND t.empresa_id=$2 AND t.status='aguardando'
           AND COALESCE(e.ativo,FALSE) AND COALESCE(e.slug,'')<>'aurox-plataforma'
           AND t.created_at <= now()-interval '10 seconds'
         FOR UPDATE OF t SKIP LOCKED`,[alvo.id,alvo.empresa_id]);
      const t = tri.rows[0];
      if (!t) {await db.query('ROLLBACK');tx=false;ignorados++;continue;}

      // Esta linha é uma trava transacional EXCLUSIVA por empresa.
      await db.query(`INSERT INTO public.aurox_rodizio_triagem(empresa_id)
                      VALUES($1) ON CONFLICT(empresa_id) DO NOTHING`,[t.empresa_id]);
      const cursor = await db.query<{ultimo_vendedor_id:number|null}>(`
        SELECT ultimo_vendedor_id FROM public.aurox_rodizio_triagem
        WHERE empresa_id=$1 FOR UPDATE`,[t.empresa_id]);
      const candidatos = await db.query<{id:number}>(`
        SELECT v.id FROM public.vendedores v
        WHERE v.empresa_id=$1 AND COALESCE(v.ativo,FALSE)
          AND EXISTS(SELECT 1 FROM public.usuarios u
            WHERE u.vendedor_id=v.id AND u.empresa_id=v.empresa_id
              AND LOWER(u.tipo)='vendedor' AND COALESCE(u.ativo,FALSE)
              AND LOWER(COALESCE(u.status,'ativo'))='ativo')
        ORDER BY UPPER(v.nome),v.id`,[t.empresa_id]);
      const selecionado = proximoVendedorId(candidatos.rows.map(x=>Number(x.id)),
        cursor.rows[0]?.ultimo_vendedor_id == null ? null : Number(cursor.rows[0].ultimo_vendedor_id));
      if (!selecionado) {await db.query('ROLLBACK');tx=false;ignorados++;continue;}

      const novo = await db.query<{id:number}>(`
        INSERT INTO public.leads
          (nome_lead,telefone,email,produto_interesse,observacao,vendedor_id,empresa_id,data_lead,atribuido_em,rotacionar)
        VALUES($1,$2,$3,$4,$5,$6,$7,now(),now(),TRUE) RETURNING id`,
        [t.nome,t.telefone,t.email,t.interesse,`[${t.origem||'triagem'}] ${t.mensagem||''}`.trim(),selecionado,t.empresa_id]);
      const leadId = Number(novo.rows[0].id);
      await db.query(`UPDATE public.triagem SET status='atribuido',vendedor_id=$2,lead_id=$3
        WHERE id=$1 AND empresa_id=$4 AND status='aguardando'`,
        [t.id,selecionado,leadId,t.empresa_id]);
      // Manual nunca chega aqui. Falha em qualquer etapa faz ROLLBACK do cursor.
      await db.query(`UPDATE public.aurox_rodizio_triagem SET
        ultimo_vendedor_id=$2,atualizado_em=now()
        WHERE empresa_id=$1`,[t.empresa_id,selecionado]);
      await db.query('COMMIT');tx=false;atribuidos++;
      realizado={leadId,triagemId:t.id,empresaId:t.empresa_id,
        origem:String(t.origem||''),mensagem:String(t.mensagem||'')};
    } catch (e:unknown) {
      if (tx) await db.query('ROLLBACK').catch(()=>{});
      erros++;
      console.error('[triagem rodízio] falha empresa='+alvo.empresa_id,
        (e as {code?:string})?.code||'erro');
    } finally {db.release();}

    if (!realizado) continue;
    // Historico é auxiliar e não pode causar retransmissão de um lead já criado.
    try {
      if (realizado.origem==='aurox-whatsapp') {
        await query(`UPDATE public.aurox_wa_contatos SET lead_id=$1
          WHERE triagem_id=$2 AND empresa_id=$3 AND (lead_id IS NULL OR lead_id=$1)`,
          [realizado.leadId,realizado.triagemId,realizado.empresaId]);
        await query(`INSERT INTO public.chat_geral_mensagens
          (remetente_id,lead_id,mensagem,aurox_wa_mensagem_id)
          SELECT NULL,$1,m.corpo,m.id FROM public.aurox_wa_contatos c
          JOIN public.aurox_wa_mensagens m ON m.contato_id=c.id AND m.empresa_id=c.empresa_id
          WHERE c.triagem_id=$2 AND c.empresa_id=$3 AND m.direcao='recebida'
          ORDER BY m.recebida_em,m.id ON CONFLICT(aurox_wa_mensagem_id) DO NOTHING`,
          [realizado.leadId,realizado.triagemId,realizado.empresaId]);
      } else if (realizado.mensagem) {
        await query(`INSERT INTO public.chat_geral_mensagens
          (remetente_id,mensagem,lead_id) VALUES(NULL,$1,$2)`,
          [realizado.mensagem,realizado.leadId]);
      }
    } catch (e) {
      console.warn('[triagem rodízio] histórico opcional não sincronizado',
        e instanceof Error?e.message:'erro');
    }
  }
  return {ok:true,verificados:alvos.rows.length,atribuidos,ignorados,erros};
}
