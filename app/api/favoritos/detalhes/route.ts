import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Favoritos do usuário autenticado, sempre dentro do escopo empresarial e funcional. */
export async function GET(req: NextRequest) {
  const u = await requireUser(req);
  if (!u) return NextResponse.json({error:'Não autenticado'}, {status:401});
  if (u.tipo !== 'superadmin' && !u.empresa_id)
    return NextResponse.json({error:'Usuário sem empresa vinculada'}, {status:403});
  if (u.tipo === 'vendedor' && !u.vendedor_id)
    return NextResponse.json({error:'Vendedor sem vínculo autorizado'}, {status:403});
  if (u.tipo === 'gerente' && !u.loja)
    return NextResponse.json({error:'Gerente sem loja atribuída'}, {status:403});
  try {
    const {rows} = await query(`
      SELECT l.*, v.nome AS vendedor_nome
      FROM public.favoritos fav
      JOIN public.leads l ON l.id = fav.lead_id
      LEFT JOIN public.vendedores v ON v.id=l.vendedor_id AND v.empresa_id=l.empresa_id
      WHERE fav.usuario_id=$1
        AND l.empresa_id IS NOT NULL
        AND ($2::boolean OR l.empresa_id=$3)
        AND ($4::boolean = FALSE OR l.vendedor_id=$5)
        AND ($6::boolean = FALSE OR UPPER(COALESCE(v.loja,''))=UPPER($7))
      ORDER BY fav.created_at DESC
      LIMIT 300`,
      [u.id,u.tipo==='superadmin',u.empresa_id??-1,u.tipo==='vendedor',u.vendedor_id??-1,u.tipo==='gerente',u.loja??'']);
    return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});
  } catch(e) {
    console.error('[favoritos detalhes]',e instanceof Error ? e.message : 'falha');
    return NextResponse.json({error:'Falha ao consultar favoritos'}, {status:500});
  }
}
