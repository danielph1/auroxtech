import { NextRequest, NextResponse } from 'next/server';
import { getBearer, verifySession } from '@/lib/session';
import { STATUS_LOGIN_OK } from '@/lib/tenant';
import { queryOne } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** AUROX_LOGIN_PLANOS_20261117: somente identidade, conta e empresa. Nao testa modulos contratados. */
export async function GET(req: NextRequest) {
  const jwt = getBearer(req);
  const sessao = jwt ? verifySession(jwt) : null;
  if (!sessao) return NextResponse.json({error:'Sessao invalida'},{status:401,headers:{'Cache-Control':'private, no-store'}});

  try {
    const row = await queryOne<{
      id:number;login:string;nome:string|null;tipo:string;vendedor_id:number|null;
      loja:string|null;ativo:boolean;status:string;foto_url:string;
      empresa_id:number|null;empresa_nome:string|null;empresa_ativa:boolean|null;
    }>(`SELECT u.id,u.login,u.nome,u.tipo,u.vendedor_id,u.loja,
      COALESCE(u.ativo,FALSE) AS ativo,COALESCE(u.status,'ativo') AS status,
      COALESCE(u.foto_url,'') AS foto_url,u.empresa_id,
      e.nome AS empresa_nome,e.ativo AS empresa_ativa
      FROM public.usuarios u LEFT JOIN public.empresas e ON e.id=u.empresa_id
      WHERE u.id=$1`,[sessao.id]);
    if (!row || !row.ativo || !STATUS_LOGIN_OK.has(String(row.status).toLowerCase()) ||
        (row.empresa_id != null && row.empresa_ativa !== true)) {
      return NextResponse.json({error:'Conta ou contrato inativo'},{status:401,headers:{'Cache-Control':'private, no-store'}});
    }
    // A resposta nunca inclui hash de senha nem dados de outras empresas.
    const {id,login,nome,tipo,vendedor_id,loja,ativo,status,foto_url,empresa_id,empresa_nome} = row;
    return NextResponse.json({id,login,nome,tipo,vendedor_id,loja,ativo,status,foto_url,empresa_id,empresa_nome},
      {headers:{'Cache-Control':'private, no-store'}});
  } catch (err:any) {
    console.error('[auth/me] validacao indisponivel',String(err?.code||'erro'));
    // Banco indisponivel nao significa token invalido: evitar logout falso.
    return NextResponse.json({error:'Validacao de sessao temporariamente indisponivel'},
      {status:503,headers:{'Cache-Control':'private, no-store','Retry-After':'3'}});
  }
}
