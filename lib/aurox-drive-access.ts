import type {NextRequest} from 'next/server';
import {requireUser} from '@/lib/session';
import {getPool} from '@/lib/db';
export async function conferirAcessoDrive(req:NextRequest,empresaId:number){
 const u=await requireUser(req);if(!u)throw new Error('Não autenticado.');
 const role=String(u.tipo||'').toLowerCase();
 if(!['superadmin','admin','gerente','marketing'].includes(role))throw new Error('Sem permissão.');
 if(!Number.isSafeInteger(empresaId)||empresaId<1||(role!=='superadmin'&&Number(u.empresa_id)!==empresaId))throw new Error('Empresa fora do escopo.');
 const db=await getPool().connect();try{const {rows}=await db.query('SELECT id,slug FROM public.empresas WHERE id=$1 AND COALESCE(ativo,true)',[empresaId]);
  if(!rows.length)throw new Error('Empresa inexistente ou inativa.');
  if(rows[0].slug==='aurox-plataforma'&&role!=='superadmin')throw new Error('Empresa interna restrita.');
 }finally{db.release();}
 return u;
}
