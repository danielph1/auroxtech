import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
export const runtime='nodejs'; export const dynamic='force-dynamic';
const manage=new Set(['superadmin','admin','gerente']);
const positive=(x:unknown)=>{const n=Number(x);return Number.isSafeInteger(n)&&n>0?n:0};
export async function PATCH(req:NextRequest){
 const u=await requireUser(req);if(!u)return NextResponse.json({error:'Não autenticado'},{status:401});
 const role=String(u.tipo||'').toLowerCase();if(!manage.has(role))return NextResponse.json({error:'Sem permissão para editar metas'},{status:403});
 const b=await req.json().catch(()=>null);const id=positive(b?.id);
 const titulo=String(b?.titulo||'').trim(),descricao=String(b?.descricao||'').trim(),unidade=String(b?.unidade||'un').trim();
 const objetivo=b?.valor_objetivo===''||b?.valor_objetivo==null?null:Number(b.valor_objetivo);
 const inicio=String(b?.periodo_inicio||''),fim=String(b?.periodo_fim||'');
 if(!id||titulo.length<1||titulo.length>180||descricao.length>2000||unidade.length<1||unidade.length>20||
  (objetivo!==null&&(!Number.isFinite(objetivo)||objetivo<0))||
  (inicio&&!/^\d{4}-\d{2}-\d{2}$/.test(inicio))||(fim&&!/^\d{4}-\d{2}-\d{2}$/.test(fim))||
  (inicio&&fim&&inicio>fim))return NextResponse.json({error:'Título, objetivo ou período inválido'},{status:400});
 const db=await getPool().connect();
 try{
  await db.query('BEGIN');
  const {rows}=await db.query(`SELECT m.id,m.empresa_id,m.destinatario_id,m.destinatario_tipo,m.destinatario_loja,
     z.loja AS loja_destinatario FROM public.metas m LEFT JOIN public.usuarios z ON z.id=m.destinatario_id
     WHERE m.id=$1 AND COALESCE(m.ativo,TRUE)=TRUE FOR UPDATE OF m`,[id]);const m=rows[0];
  if(!m?.empresa_id||(role!=='superadmin'&&Number(m.empresa_id)!==Number(u.empresa_id))){await db.query('ROLLBACK');return NextResponse.json({error:'Meta fora da sua empresa'},{status:403});}
  const lojaAlvo=String(m.destinatario_loja||m.loja_destinatario||'').toUpperCase();
  if(role==='gerente'&&(!u.loja||!lojaAlvo||lojaAlvo!==String(u.loja).toUpperCase())){
    await db.query('ROLLBACK');return NextResponse.json({error:'Gerente só pode editar metas da própria loja'},{status:403});
  }
  const updated=await db.query(`UPDATE public.metas SET titulo=$1,descricao=$2,valor_objetivo=$3,unidade=$4,
    periodo_inicio=COALESCE($5::date,periodo_inicio),periodo_fim=COALESCE($6::date,periodo_fim),updated_at=NOW()
    WHERE id=$7 AND empresa_id=$8 RETURNING id,titulo,descricao,valor_objetivo,unidade,periodo_inicio,periodo_fim`,
    [titulo,descricao||null,objetivo,unidade,inicio||null,fim||null,id,m.empresa_id]);
  await db.query('COMMIT');return NextResponse.json({ok:true,meta:updated.rows[0]},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){await db.query('ROLLBACK').catch(()=>{});console.error('[meta editar]',e instanceof Error?e.message:'erro');return NextResponse.json({error:'Não foi possível editar a meta'},{status:503});}
 finally{db.release()}
}
