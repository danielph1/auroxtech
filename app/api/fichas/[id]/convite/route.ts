import {NextRequest,NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {getPool,query,queryOne} from '@/lib/db';
import {requireUser,type SessionUser} from '@/lib/session';
import {fichaAcessivel} from '@/lib/ficha-access';
import {modulosDisponiveis} from '@/lib/aurox-modulos-server';
import {sendAuroxMessage} from '@/lib/aurox-whatsapp/send';
import {phoneToZapi} from '@/lib/aurox-whatsapp/phone';
import {novoToken,hashToken,urlPublicaFicha,decifrarDados,confirmarConfiguracao} from '@/lib/aurox-ficha-portal';
export const runtime='nodejs';export const dynamic='force-dynamic';
const json=(b:object,s=200)=>NextResponse.json(b,{status:s,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
type FichaInfo={id:number;lead_id:number;vendedor_id:number|null;empresa_id:number;loja:string|null;telefone:string|null;nome_lead:string|null;vendedor_empresa_id:number};
async function escopo(req:NextRequest,id:number):Promise<{u:SessionUser;f:FichaInfo}|null>{
 const u=await requireUser(req);if(!u||!Number.isSafeInteger(id)||id<=0)return null;
 const f=await queryOne<FichaInfo>(`SELECT f.id,f.lead_id,l.vendedor_id,l.empresa_id,v.loja,l.telefone,l.nome_lead,v.empresa_id AS vendedor_empresa_id
  FROM public.fichas_credito f JOIN public.leads l ON l.id=f.lead_id
  JOIN public.vendedores v ON v.id=l.vendedor_id
  JOIN public.empresas e ON e.id=l.empresa_id AND e.ativo=TRUE
  WHERE f.id=$1 AND (f.vendedor_id IS NULL OR f.vendedor_id=l.vendedor_id) AND v.empresa_id=l.empresa_id`,[id]);
 if(!f||!f.vendedor_id||!await fichaAcessivel(u,f))return null;
 if(u.tipo==='vendedor'&&Number(f.vendedor_id)!==Number(u.vendedor_id))return null;
 if(u.tipo==='gerente'&&String(f.loja||'').toUpperCase()!==String(u.loja||'').toUpperCase())return null;
 if(u.tipo!=='superadmin'&&Number(f.empresa_id)!==Number(u.empresa_id))return null;
 return {u,f};
}
type Ctx={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Ctx){
 try{const id=Number((await params).id),s=await escopo(req,id);if(!s)return json({error:'Ficha indisponivel'},403);
 const {rows}=await query<any>(`SELECT c.id,c.criado_em,c.expira_em,c.usado_em,c.revogado_em,c.enviado_whatsapp,r.status,r.criado_em AS respondido_em,r.payload_cifrado
 FROM public.aurox_ficha_portal_convites c LEFT JOIN public.aurox_ficha_portal_respostas r ON r.convite_id=c.id AND r.empresa_id=c.empresa_id
 WHERE c.empresa_id=$1 AND c.ficha_id=$2 ORDER BY c.criado_em DESC LIMIT 5`,[s.f.empresa_id,id]);
 const convites=rows.map(r=>{const {payload_cifrado,...c}=r;return {...c,dados:r.status==='pendente'&&payload_cifrado?decifrarDados(payload_cifrado):null}});
 const active=await queryOne<{n:number}>(`SELECT count(DISTINCT lead_id)::int AS n FROM public.aurox_ficha_portal_convites WHERE empresa_id=$1 AND vendedor_id=$2 AND usado_em IS NULL AND revogado_em IS NULL AND expira_em>now()`,[s.f.empresa_id,s.f.vendedor_id]);
 return json({convites,responsavel_vendedor_id:s.f.vendedor_id,convites_ativos:active?.n||0,limite_convites:3});
 }catch{return json({error:'Falha ao consultar convites'},503)}
}
export async function POST(req:NextRequest,{params}:Ctx){
 const b=await req.json().catch(()=>null);const id=Number((await params).id);
 if(!['qr','whatsapp'].includes(b?.modo))return json({error:'Modo invalido'},400);
 try{
 const s=await escopo(req,id);if(!s||!['vendedor','admin','gerente','superadmin'].includes(s.u.tipo))return json({error:'Sem acesso para criar convite'},403);
 // O QR tambem exige telefone real: a autenticacao usa codigo enviado ao numero do lead.
 const modulos=await modulosDisponiveis({tipo:'admin',empresa_id:s.f.empresa_id});
 if(!modulos.includes('crm'))return json({error:'A empresa precisa do modulo CRM para gerar fichas externas'},403);
 const phone=phoneToZapi(s.f.telefone);
 if(!/^\d{12,15}$/.test(phone))return json({error:'Cadastre um telefone valido com DDD no lead antes de gerar o convite.'},400);
 // Sem sessao WhatsApp contratada, nao simular envio automatico.
 if(b.modo==='whatsapp'){
  if(!modulos.includes('whatsapp'))return json({error:'O envio automatico exige o modulo Aurox-WhatsApp da empresa'},403);
  if(!s.f.telefone)return json({error:'Lead sem telefone; confira o cadastro antes de enviar'},400);
 }
 confirmarConfiguracao();
 const token=novoToken();const hash=hashToken(token);const url=urlPublicaFicha(token);
 const db=await getPool().connect();let conviteId='';
 try{
  await db.query('BEGIN');
  const locked=await db.query('SELECT id FROM public.fichas_credito WHERE id=$1 FOR UPDATE',[id]);
  if(!locked.rowCount)throw Error('Ficha inexistente');
  // Serialização interempresas e entre requisições concorrentes do mesmo vendedor/cliente.
  // Nao depende de indice parcial com NOW(), que o PostgreSQL nao permite.
  await db.query('SELECT pg_advisory_xact_lock(914206,$1::int)',[s.f.lead_id]);
  await db.query('SELECT pg_advisory_xact_lock(914205,$1::int)',[s.f.vendedor_id]);
  const older=await db.query(`SELECT id,expira_em FROM public.aurox_ficha_portal_convites
   WHERE empresa_id=$1 AND lead_id=$2 AND usado_em IS NULL AND revogado_em IS NULL AND expira_em>now()
   LIMIT 1`,[s.f.empresa_id,s.f.lead_id]);
  if(older.rowCount){await db.query('ROLLBACK');return json({error:'Este cliente já possui um link ativo. Aguarde expirar; não é permitido gerar outro agora.',expira_em:older.rows[0].expira_em},409);}
  const c=await db.query(`SELECT count(DISTINCT lead_id)::int AS n FROM public.aurox_ficha_portal_convites
   WHERE empresa_id=$1 AND vendedor_id=$2 AND usado_em IS NULL AND revogado_em IS NULL AND expira_em>now()`,[s.f.empresa_id,s.f.vendedor_id]);
  if(Number(c.rows[0].n)>=3){await db.query('ROLLBACK');return json({error:'O vendedor já tem 3 clientes com convites ativos. Aguarde expirar um convite.',ativos:3},429);}

  const saved=await db.query(`INSERT INTO public.aurox_ficha_portal_convites
   (empresa_id,ficha_id,lead_id,vendedor_id,criado_por,token_hash,expira_em)
   VALUES($1,$2,$3,$4,$5,$6,now()+interval '30 minutes') RETURNING id`,
   [s.f.empresa_id,id,s.f.lead_id,s.f.vendedor_id,s.u.id,hash]);
  conviteId=String(saved.rows[0].id);
  await db.query(`INSERT INTO public.aurox_ficha_portal_auditoria(convite_id,empresa_id,ator_id,evento) VALUES($1,$2,$3,'criado')`,[conviteId,s.f.empresa_id,s.u.id]);
  await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release();}
 let enviado=false, aviso='';
 if(b.modo==='whatsapp'){
  try{
   const delivery=await sendAuroxMessage(s.f.empresa_id,s.f.lead_id,`Sua ficha de cadastro segura está disponível por 30 minutos: ${url}\nAo concluir, o link é desativado. Não compartilhe com terceiros.`,s.f.telefone);
   enviado=delivery.ok&&delivery.status==='sent_to_provider';
   if(enviado){
    // Falhas no registro auxiliar NÃO podem transformar convite criado em HTTP 503.
    try{
     await query(`UPDATE public.aurox_ficha_portal_convites SET enviado_whatsapp=TRUE WHERE id=$1 AND empresa_id=$2`,[conviteId,s.f.empresa_id]);
     await query(`INSERT INTO public.aurox_ficha_portal_auditoria(convite_id,empresa_id,ator_id,evento) VALUES($1,$2,$3,'link_enviado')`,[conviteId,s.f.empresa_id,s.u.id]);
    }catch(err:any){console.error('[ficha-portal] falha em auditoria de envio',err?.code||'indefinido')}
   }else aviso='O envio pelo WhatsApp não foi confirmado. O convite foi criado; utilize o QR/link disponível ou confira a conexão.';
  }catch(err:any){console.error('[ficha-portal] transporte WhatsApp',err?.code||'indefinido');aviso='O convite foi criado, mas o WhatsApp não confirmou o envio. Utilize o QR/link.';}
 }
 return json({ok:true,link:url,expira_em:new Date(Date.now()+30*60000).toISOString(),whatsapp_enviado:enviado,aviso,responsavel_vendedor_id:s.f.vendedor_id},201);
 }catch(e:any){
  const ref=randomUUID().slice(0,8);
  // Somente os logs internos recebem detalhes do banco. Não retornar SQL/chaves ao navegador.
  const codigo=String(e?.code||'');
  const mensagem=String(e?.message||'');
  console.error('[ficha-portal] convite',ref,{codigo,erro:mensagem.slice(0,250),constraint:String(e?.constraint||'').slice(0,70)});
  if(mensagem.includes('AUROX_FICHA_PORTAL_SECRET'))return json({error:'Portal indisponível: configuração de segurança ausente. Contate o responsável técnico.',codigo:'CONFIG_SEGURANCA',referencia:ref},503);
  if(codigo==='42P01'||codigo==='42703')return json({error:'Portal indisponível: migração do banco incompleta. Contate o responsável técnico.',codigo:'MIGRACAO_PENDENTE',referencia:ref},503);
  if(codigo==='23514'||codigo==='23503')return json({error:'A ficha não pôde ser vinculada: confira o vendedor responsável, a empresa e o cadastro.',codigo:'VINCULO_INVALIDO',referencia:ref},409);
  if(codigo==='42501')return json({error:'Permissão do banco insuficiente para gerar o convite. Contate o responsável técnico.',codigo:'PERMISSAO_BANCO',referencia:ref},503);
  return json({error:'Não foi possível gerar convite. Informe a referência ao suporte.',codigo:'FALHA_INTERNA',referencia:ref},503);
 }
}
export async function PATCH(req:NextRequest,{params}:Ctx){
 const b=await req.json().catch(()=>null);
 if(!b||!['aprovado','recusado','revogar'].includes(b.acao)||typeof b.convite_id!=='string'||!/^[0-9a-f-]{36}$/i.test(b.convite_id))return json({error:'Solicitacao invalida'},400);
 try{
  const id=Number((await params).id),s=await escopo(req,id);if(!s)return json({error:'Sem acesso'},403);
  const db=await getPool().connect();
  try{
   await db.query('BEGIN');
   const r=await db.query(`SELECT c.*,r.status AS resposta_status,r.payload_cifrado
    FROM public.aurox_ficha_portal_convites c LEFT JOIN public.aurox_ficha_portal_respostas r ON r.convite_id=c.id AND r.empresa_id=c.empresa_id
    WHERE c.id=$1 AND c.empresa_id=$2 AND c.ficha_id=$3 FOR UPDATE OF c`,[b.convite_id,s.f.empresa_id,id]);
   if(!r.rowCount){await db.query('ROLLBACK');return json({error:'Convite nao encontrado'},404)}
   const c=r.rows[0];
   if(b.acao==='revogar'){
    if(c.usado_em){await db.query('ROLLBACK');return json({error:'Link ja utilizado'},409)}
    await db.query(`UPDATE public.aurox_ficha_portal_convites SET revogado_em=now() WHERE id=$1 AND empresa_id=$2`,[c.id,s.f.empresa_id]);
   }else{
    if(c.resposta_status!=='pendente'||!c.payload_cifrado){await db.query('ROLLBACK');return json({error:'Resposta nao esta pendente'},409)}
    if(b.acao==='aprovado'){
      const d=decifrarDados(c.payload_cifrado);
      // Campos estritamente aprovados. O cliente nao muda banco, empresa, responsavel ou status.
      const q=await db.query(`UPDATE public.leads SET nome_completo=$1,cpf=$2,data_nascimento=$3,rg=$4,nome_mae=$5,email=$6,cep=$7,endereco=$8,bairro=$9,cidade=$10,estado=$11,salario=$12,telefone=$16,produto_interesse=COALESCE(NULLIF($17::text,''),produto_interesse),carro_selecionado=COALESCE(NULLIF($17::text,''),carro_selecionado),valor_entrada=$18,habilitado=COALESCE($19::boolean,habilitado)
       WHERE id=$13 AND empresa_id=$14 AND vendedor_id=$15 RETURNING id`,
       [d.nome_completo,d.cpf,d.data_nascimento,d.rg||null,d.nome_mae||null,d.email||null,d.cep||null,d.endereco||null,d.bairro||null,d.cidade||null,d.estado||null,d.salario?Number(String(d.salario).replace(',','.')):null,s.f.lead_id,s.f.empresa_id,s.f.vendedor_id,d.telefone,d.carro_interesse,Number(String(d.valor_entrada).replace(',','.')),d.habilitado==='sim'?true:d.habilitado==='nao'?false:null]);
      if(!q.rowCount)throw Error('Lead alterado ou fora do escopo');
    }
    await db.query(`UPDATE public.aurox_ficha_portal_respostas SET status=$1,revisado_por=$2,revisado_em=now() WHERE convite_id=$3 AND empresa_id=$4 AND status='pendente'`,[b.acao,s.u.id,c.id,s.f.empresa_id]);
   }
   await db.query(`INSERT INTO public.aurox_ficha_portal_auditoria(convite_id,empresa_id,ator_id,evento) VALUES($1,$2,$3,$4)`,[c.id,s.f.empresa_id,s.u.id,b.acao==='revogar'?'revogado':b.acao]);
   await db.query('COMMIT');return json({ok:true});
  }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release()}
 }catch{return json({error:'Nao foi possivel revisar a resposta'},503)}
}
