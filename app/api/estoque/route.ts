import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { prepararVeiculo } from '@/lib/aurox-veiculo-cadastro';
import { requireUser } from '@/lib/session';
import { isSuperAdmin } from '@/lib/tenant';
import { variantesBusca } from '@/lib/fuzzy';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const u = await requireUser(req);
  if (!u) return NextResponse.json({ error: 'não autenticado' }, { status: 401 });
  try {
    const busca = (new URL(req.url).searchParams.get('busca') || '').trim();
    const params: unknown[] = [];
    let where = '1=1';

    if (!isSuperAdmin(u)) {
      if (!u.empresa_id) return NextResponse.json({ error: 'Empresa nao associada' }, { status: 403 });
      params.push(u.empresa_id);
      where += ` AND empresa_id = $${params.length}`;
    }

    if (busca) {
      const vars = variantesBusca(busca);
      const parts: string[] = [];
      params.push(`%${busca}%`);
      const p0 = `$${params.length}`;
      parts.push(
        `(marca ILIKE ${p0} OR modelo ILIKE ${p0} OR placa ILIKE ${p0} OR COALESCE(carro,'') ILIKE ${p0} OR COALESCE(cor,'') ILIKE ${p0} OR COALESCE(carroceria,'') ILIKE ${p0})`,
      );
      for (const v of vars) {
        if (v.toLowerCase() === busca.toLowerCase()) continue;
        params.push(`%${v}%`);
        const p = `$${params.length}`;
        parts.push(`(marca ILIKE ${p} OR modelo ILIKE ${p} OR COALESCE(carro,'') ILIKE ${p})`);
      }
      params.push(busca.toLowerCase());
      const pt = `$${params.length}`;
      const trgm = ` OR similarity(lower(COALESCE(modelo,'')), ${pt}) > 0.25
                     OR similarity(lower(COALESCE(marca,'')), ${pt}) > 0.25
                     OR similarity(lower(concat_ws(' ', marca, modelo)), ${pt}) > 0.3`;
      where += ` AND (${parts.join(' OR ')}${trgm})`;
    }

    try {
      const { rows } = await query(
        `SELECT e.*, (
            SELECT f.url FROM public.estoque_fotos f
            WHERE f.carro_id = e.id ORDER BY f.ordem, f.id LIMIT 1
          ) AS capa_url
         FROM public.estoque_carros e WHERE ${where} ORDER BY e.id DESC LIMIT 200`,
        params,
      );
      return NextResponse.json(rows);
    } catch {
      // sem pg_trgm: só variantes
      const params2: unknown[] = [];
      let where2 = '1=1';
      if (!isSuperAdmin(u)) {
        if (!u.empresa_id) return NextResponse.json({ error: 'Empresa nao associada' }, { status: 403 });
        params2.push(u.empresa_id);
        where2 += ` AND empresa_id = $${params2.length}`;
      }
      if (busca) {
        const vars = variantesBusca(busca);
        const parts: string[] = [];
        for (const v of [busca, ...vars]) {
          params2.push(`%${v}%`);
          const p = `$${params2.length}`;
          parts.push(
            `(marca ILIKE ${p} OR modelo ILIKE ${p} OR placa ILIKE ${p} OR COALESCE(carro,'') ILIKE ${p})`,
          );
        }
        where2 += ` AND (${parts.join(' OR ')})`;
      }
      const { rows } = await query(
        `SELECT e.*, (
            SELECT f.url FROM public.estoque_fotos f
            WHERE f.carro_id = e.id ORDER BY f.ordem, f.id LIMIT 1
          ) AS capa_url
         FROM public.estoque_carros e WHERE ${where2} ORDER BY e.id DESC LIMIT 200`,
        params2,
      );
      return NextResponse.json(rows);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

/** AUROX_VEICULO_FICHA_PRECOS_V1: preserva todos os campos opcionais e preço/observação por portal. */
export async function POST(req: NextRequest) {
  const user=await requireUser(req);
  if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
  const role=String(user.tipo||'').toLowerCase();
  if(!['superadmin','admin','gerente','marketing'].includes(role))return NextResponse.json({error:'Sem permissão'},{status:403});
  const b=await req.json().catch(()=>null);
  if(!b||typeof b!=='object'||Array.isArray(b))return NextResponse.json({error:'Dados inválidos'},{status:400});
  let v:ReturnType<typeof prepararVeiculo>;
  try{v=prepararVeiculo(b);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Cadastro inválido'},{status:400});}
  const empresaId=role==='superadmin'?Number(b.empresa_id):Number(user.empresa_id);
  if(!Number.isSafeInteger(empresaId)||empresaId<1)return NextResponse.json({error:'Empresa obrigatória'},{status:400});
  const patio=role==='gerente'?String(user.loja||'').trim().toUpperCase():String(b.patio||user.loja||'').trim().toUpperCase();
  if(!patio)return NextResponse.json({error:'Selecione a loja do veículo'},{status:400});
  const client=await getPool().connect();
  try{
    await client.query('BEGIN');
    const empresa=await client.query('SELECT id FROM public.empresas WHERE id=$1 AND COALESCE(ativo,TRUE)',[empresaId]);
    const loja=await client.query('SELECT id FROM public.lojas WHERE empresa_id=$1 AND UPPER(codigo)=$2 AND COALESCE(ativo,TRUE)',[empresaId,patio]);
    if(!empresa.rowCount||!loja.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Empresa/loja inexistente ou não autorizada'},{status:403});}
    if(v.placa){
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-estoque:${empresaId}:${v.placa}`]);
      const dup=await client.query(`SELECT id FROM public.estoque_carros WHERE empresa_id=$1
        AND REGEXP_REPLACE(UPPER(COALESCE(placa,'')),'[^A-Z0-9]','','g')=$2 LIMIT 1`,[empresaId,v.placa]);
      if(dup.rowCount){await client.query('ROLLBACK');return NextResponse.json({error:'Placa já cadastrada nesta empresa'},{status:409});}
    }
    const result=await client.query(`INSERT INTO public.estoque_carros
      (empresa_id,marca,modelo,carro,placa,ano,cor,preco,patio,status,km,carroceria,aurox_detalhes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'Disponível',$10,$11,$12::jsonb) RETURNING id`,
      [empresaId,v.marca,v.modelo,`${v.marca} ${v.modelo}`,v.placa,v.ano,v.cor,v.preco,patio,
       v.detalhes.km??null,v.detalhes.carroceria||null,JSON.stringify(v.detalhes)]);
    await client.query('COMMIT');
    return NextResponse.json({ok:true,id:result.rows[0].id},{status:201,headers:{'Cache-Control':'no-store'}});
  }catch(e:any){
    await client.query('ROLLBACK').catch(()=>{});
    console.error('[estoque cadastro completo]',e?.code||'erro');
    const migracao=['42703','23502'].includes(String(e?.code||''));
    return NextResponse.json({error:migracao?'Cadastro completo indisponível: confira a migração 202611080003_veiculos_detalhes.sql. Nenhum veículo foi criado.':'Não foi possível cadastrar veículo. Confira os dados e a estrutura do estoque.'},{status:503});
  }finally{client.release();}
}
