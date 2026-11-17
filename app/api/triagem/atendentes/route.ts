import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';

export const runtime='nodejs';
export const dynamic='force-dynamic';

/** Somente responsáveis vinculados à empresa do lead; nenhum nome de outras empresas. */
export async function GET(req:NextRequest){
 const user=await requireUser(req);
 if(!user)return NextResponse.json({error:'Não autenticado'},{status:401});
 const tipo=String(user.tipo||'').toLowerCase();
 if(!['superadmin','admin','gerente','marketing'].includes(tipo))
   return NextResponse.json({error:'Sem permissão'},{status:403});
 const empresaId=Number(req.nextUrl.searchParams.get('empresa_id'));
 if(!Number.isSafeInteger(empresaId)||empresaId<1)
   return NextResponse.json({error:'Empresa inválida'},{status:400});
 if(tipo!=='superadmin'&&Number(user.empresa_id)!==empresaId)
   return NextResponse.json({error:'Empresa fora do escopo'},{status:403});
 const db=await getPool().connect();
 try{
  const {rows:empresas}=await db.query<{slug:string}>(
    'SELECT slug FROM public.empresas WHERE id=$1 AND coalesce(ativo,true)',[empresaId]);
  if(!empresas.length)return NextResponse.json({error:'Empresa inexistente'},{status:404});
  const interna=empresas[0].slug==='aurox-plataforma';
  if(interna){
   if(tipo!=='superadmin')return NextResponse.json({error:'Área exclusiva do superadmin'},{status:403});
   const {rows}=await db.query(`SELECT v.id,v.nome,v.loja,v.empresa_id
     FROM public.aurox_atendentes_internos a
     JOIN public.vendedores v ON v.id=a.vendedor_id AND v.empresa_id=a.empresa_id
     JOIN public.usuarios u ON u.id=a.usuario_id
     WHERE a.empresa_id=$1 AND coalesce(v.ativo,false)
       AND lower(u.tipo)='superadmin' AND coalesce(u.ativo,false)
       AND lower(coalesce(u.status,'ativo'))='ativo'
     ORDER BY v.nome,v.id`,[empresaId]);
   return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});
  }
  const params:unknown[]=[empresaId];let lojaFilter='';
  if(tipo==='gerente'&&user.loja){params.push(user.loja);lojaFilter=` AND upper(coalesce(v.loja,''))=upper($2)`;}
  const {rows}=await db.query(`SELECT v.id,v.nome,v.loja,v.empresa_id
    FROM public.vendedores v WHERE v.empresa_id=$1 AND coalesce(v.ativo,false)
    AND EXISTS(SELECT 1 FROM public.usuarios u WHERE u.vendedor_id=v.id AND u.empresa_id=v.empresa_id
      AND lower(u.tipo)='vendedor' AND coalesce(u.ativo,false)
      AND lower(coalesce(u.status,'ativo'))='ativo')
    ${lojaFilter} ORDER BY v.nome,v.id`,params);
  return NextResponse.json(rows,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){console.error('[triagem atendentes]',e instanceof Error?e.message:'erro');
  return NextResponse.json({error:'Falha ao consultar atendentes'},{status:503});}
 finally{db.release();}
}
