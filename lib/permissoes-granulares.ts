/** Negação ou liberação granular: SEMPRE abaixo da hierarquia, isolamento e plano existentes. */
import {queryOne,query} from '@/lib/db';
import {NIVEIS} from '@/lib/hierarquia-usuarios';
import type {SessionUser} from '@/lib/session';

export const RECURSOS = [
  ['leads','Leads'],['triagem','Triagem'],['conversas','Conversas'],
  ['fichas','Fichas'],['estoque','Estoque'],['oficina','Oficina'],
  ['anuncios','Anúncios'],['faturamento','Faturamento'],
  ['financeiro','Finanças'],['fiscal','Fiscal e Tributos'],
  ['integracoes','Integrações'],['usuarios','Usuários'],['metricas','Métricas'],
] as const;
export const ACOES = ['visualizar','criar','editar','excluir','enviar'] as const;
export type Recurso = typeof RECURSOS[number][0];
export type Acao = typeof ACOES[number];
/** Exibe só ações que fazem sentido no domínio; outras rotas continuam com seus controles existentes. */
export const ACOES_RECURSO:Record<Recurso,readonly Acao[]>={
 leads:['visualizar','criar','editar','excluir'],triagem:['visualizar','criar','editar','excluir'],
 conversas:['visualizar','enviar','excluir'],fichas:['visualizar','criar','editar','excluir'],
 estoque:['visualizar','criar','editar','excluir'],oficina:['visualizar','criar','editar','excluir'],
 anuncios:['visualizar','criar','editar','excluir'],faturamento:['visualizar','criar','editar','excluir'],
 financeiro:['visualizar','criar','editar','excluir'],fiscal:['visualizar','criar','excluir'],
 integracoes:['visualizar','criar','editar','excluir'],usuarios:['visualizar','criar','editar','excluir'],
 metricas:['visualizar'],
};

const TODOS=['superadmin','admin','gerente','marketing','vendedor','mecanico','guariba','documentista','documento','elfenai','elfen_ai','elfenaí'];
const COMERCIAL=['superadmin','admin','gerente','marketing','vendedor'];
const GESTORES=['superadmin','admin','gerente','marketing'];
const FINANCEIRO=['superadmin','admin'];
export const PAPEIS_BASE:Record<Recurso,string[]> = {
 leads:COMERCIAL,triagem:GESTORES,conversas:COMERCIAL,
 fichas:[...COMERCIAL,'elfenai','elfen_ai','elfenaí'],
 estoque:TODOS,oficina:[...TODOS],anuncios:GESTORES,
 faturamento:[...COMERCIAL,'documentista','documento'],
 financeiro:FINANCEIRO,fiscal:FINANCEIRO,
 integracoes:['superadmin','admin','marketing'],
 usuarios:['superadmin','admin','marketing'],metricas:GESTORES,
};
export function permitidoPeloCargo(papel:unknown,recurso:Recurso){
 return PAPEIS_BASE[recurso].includes(String(papel||'').toLowerCase());
}
export function recursoAcaoDaRota(pathname:string,method:string):{recurso:Recurso;acao:Acao}|null{
 const rules:Array<[string,Recurso]>=[
  ['/api/financas/fiscal','fiscal'], ['/api/financas','financeiro'],
  ['/api/gestao-usuarios','usuarios'],['/api/integracoes','integracoes'],
  ['/api/triagem','triagem'],['/api/chat','conversas'],
  ['/api/leads','leads'],['/api/estoque','estoque'],
  ['/api/oficina','oficina'],['/api/anuncios','anuncios'],
  ['/api/faturamento','faturamento'],['/api/fichas','fichas'],
  ['/api/metricas','metricas'],
 ];
 const match=rules.find(([p])=>pathname===p||pathname.startsWith(p+'/'));
 if(!match)return null;
 const acao:Acao=method==='GET'?'visualizar':method==='DELETE'?'excluir':method==='POST'
  ?(match[1]==='conversas'?'enviar':'criar'):'editar';
 return {recurso:match[1],acao};
}
export {recursoDaPagina} from './permissoes-granulares-client';
export function podeAlterarPapel(ator:unknown,destino:unknown){
 const a=String(ator||'').toLowerCase(),d=String(destino||'').toLowerCase();
 return ['admin','superadmin'].includes(a) && a!==d && d!=='superadmin' &&
   Number.isInteger(NIVEIS[a]) && Number.isInteger(NIVEIS[d]) && NIVEIS[a]<NIVEIS[d];
}
export async function temPermissaoGranular(u:SessionUser,recurso:Recurso,acao:Acao){
 if(u.tipo==='superadmin')return true;
 if(!permitidoPeloCargo(u.tipo,recurso))return false;
 const empresa=Number(u.empresa_id||0);
 if(!Number.isSafeInteger(empresa)||empresa<=0)return false;
 try{
  const row=await queryOne<{permitido:boolean}>(`
   SELECT COALESCE(
    (SELECT p.permitido FROM public.aurox_permissoes_usuario p
      WHERE p.empresa_id=$1 AND p.usuario_id=$2 AND p.recurso=$3 AND p.acao=$4),
    (SELECT p.permitido FROM public.aurox_permissoes_cargo p
      WHERE p.empresa_id=$1 AND p.cargo=$5 AND p.recurso=$3 AND p.acao=$4),
    true) AS permitido`,[empresa,u.id,recurso,acao,u.tipo]);
  return row?.permitido===true;
 }catch(e:any){
  // Migração ainda não aplicada: preservar comportamento legado SEM conceder novos papéis.
  if(e?.code==='42P01')return true;
  console.error('[aurox] erro na autorização granular',String(e?.code||'db'));
  return false;
 }
}
export async function permissoesBloqueadas(u:SessionUser):Promise<Recurso[]>{
 if(u.tipo==='superadmin')return [];
 const empresa=Number(u.empresa_id||0);
 if(!Number.isSafeInteger(empresa)||empresa<=0)return RECURSOS.map(([key])=>key);
 try{
  const result=await query<{recurso:Recurso;permitido:boolean}>(`
   SELECT DISTINCT ON (recurso) recurso,permitido FROM (
    SELECT recurso,permitido,2 AS prioridade FROM public.aurox_permissoes_usuario
     WHERE empresa_id=$1 AND usuario_id=$2 AND acao='visualizar'
    UNION ALL
    SELECT recurso,permitido,1 AS prioridade FROM public.aurox_permissoes_cargo
     WHERE empresa_id=$1 AND cargo=$3 AND acao='visualizar'
   ) t ORDER BY recurso,prioridade DESC`,[empresa,u.id,u.tipo]);
  return result.rows.filter(r=>!r.permitido && permitidoPeloCargo(u.tipo,r.recurso)).map(r=>r.recurso);
 }catch(e:any){
  if(e?.code==='42P01')return []; // migração ainda não aplicada: mantém perfis legados
  console.error('[aurox] falha ao listar permissões',String(e?.code||'db'));
  return RECURSOS.filter(([key])=>permitidoPeloCargo(u.tipo,key)).map(([key])=>key); // falha fechada
 }
}
