/** Rotas publicas: nunca importam requireUser nem expõem consultas do cliente ao browser. */
import {NextRequest,NextResponse} from 'next/server';
import {getPool,queryOne} from '@/lib/db';
import {tokenValido,hashToken,novoCodigo,hashCodigo,verificaCodigo,cifrarDados,respostaSchema,TEMA_PADRAO} from '@/lib/aurox-ficha-portal';
import {sendAuroxMessage} from '@/lib/aurox-whatsapp/send';
import {notificar} from '@/lib/notify';
import {query} from '@/lib/db';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff'};
const json=(body:object,status=200)=>NextResponse.json(body,{status,headers});
async function lerJsonLimitado(req:NextRequest,maxBytes=12_000):Promise<any>{
 if(!req.body)return null;
 const rd=req.body.getReader();const partes:Buffer[]=[];let n=0;
 try{while(true){const r=await rd.read();if(r.done)break;if(r.value){n+=r.value.byteLength;if(n>maxBytes)throw Error('Limite do formulario');partes.push(Buffer.from(r.value));}}}
 finally{rd.releaseLock();}
 try{return JSON.parse(Buffer.concat(partes).toString('utf8'))}catch{return null;}
}

type Row={id:string;empresa_id:number;lead_id:number;vendedor_id:number;token_hash:string;codigo_hash:string|null;codigo_envios:number;codigo_tentativas:number;codigo_ultimo_envio_em:string|null;codigo_expira_em:string|null;telefone:string|null;loja:string|null;};
const baseSql=`SELECT c.id,c.empresa_id,c.lead_id,c.vendedor_id,c.token_hash,c.codigo_hash,c.codigo_envios,c.codigo_tentativas,
 c.codigo_ultimo_envio_em,c.codigo_expira_em,l.telefone,v.loja
 FROM public.aurox_ficha_portal_convites c
 JOIN public.fichas_credito f ON f.id=c.ficha_id AND f.lead_id=c.lead_id AND (f.vendedor_id IS NULL OR f.vendedor_id=c.vendedor_id)
 JOIN public.leads l ON l.id=c.lead_id AND l.empresa_id=c.empresa_id AND l.vendedor_id=c.vendedor_id
 JOIN public.vendedores v ON v.id=c.vendedor_id AND v.empresa_id=c.empresa_id
 JOIN public.empresas e ON e.id=c.empresa_id AND e.ativo=TRUE
 JOIN public.aurox_contrato_servicos m ON m.empresa_id=c.empresa_id AND m.codigo='crm' AND m.ativo=TRUE
 JOIN public.aurox_contratos_comerciais k ON k.empresa_id=c.empresa_id AND k.status IN ('ativo','teste','rascunho')
 WHERE c.token_hash=$1 AND c.usado_em IS NULL AND c.revogado_em IS NULL AND c.expira_em>now()`;

export async function POST(req:NextRequest){
 // Bloquear payloads grandes antes de parsear; formulario e texto pequenos.
 if(Number(req.headers.get('content-length')||0)>12000)return json({error:'Requisicao muito grande'},413);
 const b=await lerJsonLimitado(req).catch(()=>null);if(!b||!tokenValido(b.token)||!['consultar','codigo','enviar'].includes(b.acao))return json({error:'Link indisponivel'},410);
 const hash=hashToken(b.token);
 try{
  if(b.acao==='consultar'){
   const row=await queryOne<Row>(baseSql,[hash]);if(!row)return json({error:'Este link nao esta mais disponivel. Solicite outro ao vendedor.'},410);
   const theme=await queryOne<any>(`SELECT titulo,mensagem,cor_primaria,cor_fundo,cor_texto,logo_data_uri,campanha,modo_banner,banners,veiculo_obrigatorio FROM public.aurox_ficha_portal_temas
    WHERE empresa_id=$1 AND loja IN ($2,'') ORDER BY (loja=$2) DESC LIMIT 1`,[row.empresa_id,row.loja||'']);
   const empresa=await queryOne<{nome:string}>(`SELECT nome FROM public.empresas WHERE id=$1`,[row.empresa_id]);
   return json({ok:true,tema:{...TEMA_PADRAO,...theme,empresa_nome:empresa?.nome||'Concessionária'},exige_codigo:true});
  }
  if(b.acao==='codigo'){
   const db=await getPool().connect();let row:Row;let code='';
   try{
    await db.query('BEGIN');
    const q=await db.query<Row>(baseSql+' FOR UPDATE OF c',[hash]);
    if(!q.rowCount){await db.query('ROLLBACK');return json({error:'Link expirado ou indisponivel'},410);}
    row=q.rows[0];
    if(!row.telefone){await db.query('ROLLBACK');return json({error:'Cadastro sem telefone; contate a concessionaria'},409)}
    if(Number(row.codigo_envios)>=3){await db.query('ROLLBACK');return json({error:'Limite de codigos deste link atingido. Solicite outro ao vendedor.'},429)}
    if(row.codigo_ultimo_envio_em && Date.now()-new Date(row.codigo_ultimo_envio_em).getTime()<60_000){await db.query('ROLLBACK');return json({error:'Aguarde um minuto antes de solicitar outro codigo'},429)}
    code=novoCodigo();const mac=hashCodigo(hash,code);
    await db.query(`UPDATE public.aurox_ficha_portal_convites SET codigo_hash=$1,codigo_expira_em=LEAST(expira_em,now()+interval '5 minutes'),
     codigo_envios=codigo_envios+1,codigo_tentativas=0,codigo_ultimo_envio_em=now() WHERE id=$2 AND empresa_id=$3`,[mac,row.id,row.empresa_id]);
    await db.query(`INSERT INTO public.aurox_ficha_portal_auditoria(convite_id,empresa_id,evento) VALUES($1,$2,'codigo_solicitado')`,[row.id,row.empresa_id]);
    await db.query('COMMIT');
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
   // O numero vem SOMENTE do lead da empresa, nunca do input do visitante.
   const empresaDoConvite=await queryOne<{nome:string}>(`SELECT nome FROM public.empresas WHERE id=$1 AND ativo=TRUE`,[row!.empresa_id]);
   const identidade=String(empresaDoConvite?.nome||'sua concessionária').slice(0,100);
   const sent=await sendAuroxMessage(row!.empresa_id,row!.lead_id,`Código temporário da ficha de cadastro de ${identidade}: ${code}. Válido por até 5 minutos. Não compartilhe.`,row!.telefone);
   if(!sent.ok||sent.status!=='sent_to_provider')return json({error:'Nao foi possivel confirmar o envio do codigo. Solicite suporte ao vendedor.'},503);
   return json({ok:true,message:'Codigo enviado pelo WhatsApp do cadastro.'});
  }
  if(b.acao==='enviar'){
   const parsed=respostaSchema.safeParse(b.dados);
   if(!parsed.success)return json({error:'Verifique CPF, nascimento, consentimento e os campos preenchidos.'},400);
   if(typeof b.codigo!=='string'||!/^[0-9]{6}$/.test(b.codigo))return json({error:'Informe o codigo de seis digitos'},400);
   const db=await getPool().connect();
   try{
    await db.query('BEGIN');
    const q=await db.query<Row>(baseSql+' FOR UPDATE OF c',[hash]);
    if(!q.rowCount){await db.query('ROLLBACK');return json({error:'Link expirado ou ja utilizado'},410)}
    const r=q.rows[0];
    // A obrigatoriedade pertence ao servidor/loja, nunca ao JSON do navegador.
    const regra=await db.query<{veiculo_obrigatorio:boolean}>(`SELECT veiculo_obrigatorio
      FROM public.aurox_ficha_portal_temas WHERE empresa_id=$1 AND loja IN ($2,'')
      ORDER BY (loja=$2) DESC LIMIT 1`,[r.empresa_id,r.loja||'']);
    const veiculoObrigatorio=regra.rows[0]?.veiculo_obrigatorio!==false;
    if(veiculoObrigatorio && String(parsed.data.carro_interesse||'').trim().length<2){
      await db.query('ROLLBACK');return json({error:'Informe o veículo de interesse para esta concessionária.'},400);
    }
    const clean=(v:string)=>v.replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'');
    if(clean(parsed.data.telefone)!==clean(r.telefone||'')){await db.query('ROLLBACK');return json({error:'Telefone diferente do cadastrado. Solicite correção ao vendedor.'},400);}
    if(Number(r.codigo_tentativas)>=5){await db.query('ROLLBACK');return json({error:'Link bloqueado; solicite outro ao vendedor'},429)}
    if(!r.codigo_hash||!r.codigo_expira_em||new Date(r.codigo_expira_em).getTime()<=Date.now()||!verificaCodigo(hash,b.codigo,r.codigo_hash)){
      await db.query(`UPDATE public.aurox_ficha_portal_convites SET codigo_tentativas=codigo_tentativas+1,
       revogado_em=CASE WHEN codigo_tentativas+1>=5 THEN now() ELSE revogado_em END WHERE id=$1 AND empresa_id=$2`,[r.id,r.empresa_id]);
      await db.query('COMMIT');return json({error:'Codigo invalido ou expirado'},400);
    }
    await db.query(`INSERT INTO public.aurox_ficha_portal_respostas(convite_id,empresa_id,payload_cifrado)
     VALUES($1,$2,$3)`,[r.id,r.empresa_id,cifrarDados(parsed.data)]);
    await db.query(`UPDATE public.aurox_ficha_portal_convites SET usado_em=now(),codigo_hash=NULL WHERE id=$1 AND empresa_id=$2`,[r.id,r.empresa_id]);
    await db.query(`INSERT INTO public.aurox_ficha_portal_auditoria(convite_id,empresa_id,evento) VALUES($1,$2,'confirmado')`,[r.id,r.empresa_id]);
    await db.query('COMMIT');
    try{const {rows}=await query<{id:number}>(`SELECT id FROM public.usuarios WHERE empresa_id=$1 AND vendedor_id=$2 AND ativo=TRUE`,[r.empresa_id,r.vendedor_id]);
      if(rows.length)await notificar({usuario_ids:rows.map(x=>x.id),empresa_id:r.empresa_id,titulo:'Ficha preenchida pelo cliente',mensagem:'Uma ficha de cliente foi enviada e aguarda conferência.',tipo:'fichas',url:'/fichas'});
    }catch{/* Falha em notificacao nao reabre nem duplica a resposta. */}
    return json({ok:true,message:'Ficha recebida. O vendedor responsavel fara a conferencia.'});
   }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e;}finally{db.release()}
  }
 }catch(e){console.error('[portal-publico] falha',e instanceof Error?e.name:'erro');return json({error:'Servico temporariamente indisponivel'},503)}
 return json({error:'Acao invalida'},400);
}
