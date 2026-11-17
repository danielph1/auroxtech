import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {cotarAurox,AUROX_MODULOS_PUBLICOS} from '@/lib/aurox-precos-publicos';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(value:object,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const clean=(s:unknown,n:number)=>String(s??'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n);
const digits=(s:unknown)=>String(s??'').replace(/\D/g,'');
const allowedStates=new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);

/** Solicitação de orçamento, não cria conta nem permite escolher empresa de destino. */
export async function POST(req:NextRequest){
  try {
    if(!String(req.headers.get('content-type')||'').startsWith('application/json'))return reply({error:'Envie JSON válido'},415);
    if(Number(req.headers.get('content-length')||'0')>12000)return reply({error:'Dados muito grandes'},413);
    const origin=req.headers.get('origin');
    const originUrl=new URL(req.url).origin;
    const publicUrl=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,'');
    if(!origin || ![originUrl,publicUrl].filter(Boolean).includes(origin))return reply({error:'Origem não autorizada'},403);
    const raw=await req.text();if(raw.length>12000)return reply({error:'Dados muito grandes'},413);
    const b=JSON.parse(raw);
    // Honeypot: bots que preenchem este campo recebem resposta neutra.
    if(b?.site_empresa_url)return reply({ok:true});
    const nome=clean(b.nome,140),empresa=clean(b.empresa,140),telefone=digits(b.telefone);
    const cidade=clean(b.cidade,90),uf=clean(b.uf,2).toUpperCase(),observacao=clean(b.observacao,450);
    const consentimento=b.consentimento===true;
    if(nome.length<3||empresa.length<2||telefone.length<10||telefone.length>15||cidade.length<2||!allowedStates.has(uf)||!consentimento)
      return reply({error:'Preencha responsável, concessionária, telefone, cidade/UF e consentimento.'},400);
    if(!Array.isArray(b.modulos)||b.modulos.length>20)return reply({error:'Módulos inválidos'},400);
    const validIds=new Set(AUROX_MODULOS_PUBLICOS.map(x=>x.id));
    const modulos=Array.from(new Set(b.modulos.filter((x:unknown):x is string=>typeof x==='string'&&validIds.has(x))));
    const numeros=Number(b.numerosWhatsApp||1);
    if(!Number.isInteger(numeros)||numeros<1||numeros>30)return reply({error:'Quantidade de WhatsApps inválida'},400);
    const cotacao=cotarAurox(modulos,numeros);
    // Não permitir forjar o destinatário a partir do formulário público.
    const destino=Number(process.env.AUROX_COMERCIAL_EMPRESA_ID);
    if(!Number.isSafeInteger(destino)||destino<1){console.error('[comercial] AUROX_COMERCIAL_EMPRESA_ID ausente');return reply({error:'Atendimento comercial temporariamente indisponível'},503);}
    const key=process.env.JWT_SECRET;
    if(!key||key.length<32){console.error('[comercial] JWT_SECRET insuficiente');return reply({error:'Atendimento comercial temporariamente indisponível'},503);}
    const ip=(req.headers.get('x-vercel-forwarded-for')||req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim().slice(0,80);
    const ipHash=createHash('sha256').update(`${key}:comercial:ip:${ip}`).digest('hex');
    const telefoneHash=createHash('sha256').update(`${key}:comercial:tel:${telefone}`).digest('hex');
    const db=await getPool().connect();
    try {
      await db.query('BEGIN');
      // Serializa solicitações do mesmo telefone para evitar duplicações concorrentes.
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-lead-comercial-ip:${ipHash}`]);
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-lead-comercial-tel:${telefoneHash}`]);
      const emp=await db.query('SELECT id FROM public.empresas WHERE id=$1 AND COALESCE(ativo,TRUE)',[destino]);
      if(!emp.rowCount){await db.query('ROLLBACK');return reply({error:'Empresa comercial não configurada ou inativa'},503);}
      const recent=await db.query(`SELECT 1 FROM public.aurox_solicitacoes_comerciais
        WHERE empresa_id=$1 AND telefone_hash=$2 AND criado_em>now()-interval '15 minutes' LIMIT 1`,[destino,telefoneHash]);
      if(recent.rowCount){await db.query('COMMIT');return reply({ok:true,duplicado:true});}
      const count=await db.query(`SELECT count(*)::int AS total FROM public.aurox_solicitacoes_comerciais
        WHERE ip_hash=$1 AND criado_em>now()-interval '1 hour'`,[ipHash]);
      if(Number(count.rows[0]?.total||0)>=5){await db.query('ROLLBACK');return reply({error:'Muitas solicitações. Tente novamente mais tarde.'},429);}
      const interesse='Solicitação de implantação AUROX';
      const mensagem=[`Empresa: ${empresa}`,`Responsável: ${nome}`,`Localização: ${cidade}/${uf}`,
        `Pacote: ${modulos.join(', ')||'Somente base'}`,`WhatsApps: ${modulos.includes('whatsapp')?numeros:0}`,
        `Mensalidade estimada: R$ ${(cotacao.normalCentavos/100).toFixed(2)}`,
        `Primeiro mês estimado: R$ ${(cotacao.primeiroMesCentavos/100).toFixed(2)}`,
        observacao?`Observações: ${observacao}`:'',
        'Solicitação pública sujeita a confirmação comercial; não é contratação automática.'].filter(Boolean).join('\n');
      const triagem=await db.query(`INSERT INTO public.triagem
        (nome,telefone,interesse,origem,mensagem,empresa_id,status)
        VALUES($1,$2,$3,'site-aurox-comercial',$4,$5,'aguardando') RETURNING id`,
        [nome,telefone,interesse,mensagem,destino]);
      await db.query(`INSERT INTO public.aurox_solicitacoes_comerciais
        (empresa_id,triagem_id,nome_empresa,nome_responsavel,telefone,cidade,uf,observacao,modulos,numeros_whatsapp,
         mensalidade_centavos,primeiro_mes_centavos,ip_hash,telefone_hash,consentimento_em)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,now())`,
        [destino,triagem.rows[0].id,empresa,nome,telefone,cidade,uf,observacao,JSON.stringify(modulos),numeros,
          cotacao.normalCentavos,cotacao.primeiroMesCentavos,ipHash,telefoneHash]);
      await db.query('COMMIT');return reply({ok:true});
    } catch(e:any){await db.query('ROLLBACK').catch(()=>{});
      console.error('[comercial] cadastro indisponível',{code:String(e?.code||''),constraint:String(e?.constraint||'').slice(0,100)});
      return reply({error:'Não foi possível registrar a solicitação. Tente novamente.'},503);
    }finally{db.release();}
  }catch(e){console.error('[comercial] corpo inválido');return reply({error:'Não foi possível validar sua solicitação'},400);}
}
