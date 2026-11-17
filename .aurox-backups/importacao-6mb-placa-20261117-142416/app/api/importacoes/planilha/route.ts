import {NextRequest, NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {requireUser} from '@/lib/session';
import {lerPlanilha} from '@/lib/aurox-importacao-arquivo';
import {processarLeads,processarVeiculos,normalizarTelefone,extrairPlacas,type EntradaLead,type EntradaVeiculo} from '@/lib/aurox-importacao-core';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const RESP=(v:object,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'no-store'}});
const ROLES=['admin','marketing','gerente','superadmin','vendedor'];
const normalPlate=(x:unknown)=>extrairPlacas(x)[0]||'';
const campos = {leads:['nome','telefone','interesse','observacao','email','origem'],veiculos:['marca','modelo','ano','preco','placa','km','cor','carroceria','patio','observacao']};

async function verificarEmpresa(db:any,empresaId:number,usuario:any){
 const role=String(usuario.tipo||'').toLowerCase();
 if(!Number.isSafeInteger(empresaId)||empresaId<1)throw new Error('Empresa obrigatória.');
 if(role!=='superadmin'&&Number(usuario.empresa_id)!==empresaId)throw new Error('Empresa fora do seu escopo.');
 const {rows}=await db.query('SELECT id,slug FROM public.empresas WHERE id=$1 AND COALESCE(ativo,TRUE)',[empresaId]);
 if(!rows.length)throw new Error('Empresa inexistente ou inativa.');
 if(rows[0].slug==='aurox-plataforma'&&role!=='superadmin')throw new Error('Empresa interna reservada ao superadmin.');
 return rows[0];
}

export async function GET(req:NextRequest){
 const u=await requireUser(req);if(!u)return RESP({error:'Não autenticado'},401);
 if(!ROLES.includes(String(u.tipo).toLowerCase()))return RESP({error:'Sem permissão'},403);
 const db=await getPool().connect();
 try{
  const {rows}=await db.query('SELECT id,nome,slug FROM public.empresas WHERE COALESCE(ativo,TRUE) AND ($1::boolean OR id=$2) ORDER BY nome',
    [String(u.tipo).toLowerCase()==='superadmin',Number(u.empresa_id)||null]);
  return RESP({empresas:rows,campos});
 }catch{ return RESP({error:'Não foi possível consultar empresas.'},503); }finally{db.release();}
}

async function pesquisarExistentes(db:any,tipo:'leads'|'veiculos',empresaId:number,rows:EntradaLead[]|EntradaVeiculo[]){
 if(tipo==='leads'){
  const numeros=(rows as EntradaLead[]).flatMap(x=>[x.telefone,'55'+x.telefone]);
  if(!numeros.length)return new Set<string>();
  const result=await db.query(`SELECT telefone FROM public.triagem
    WHERE empresa_id=$1 AND REGEXP_REPLACE(COALESCE(telefone,''),'[^0-9]','','g')=ANY($2::text[])
    UNION SELECT telefone FROM public.leads WHERE empresa_id=$1
    AND REGEXP_REPLACE(COALESCE(telefone,''),'[^0-9]','','g')=ANY($2::text[])`,[empresaId,numeros]);
  return new Set<string>(result.rows.map((r:any)=>normalizarTelefone(r.telefone)).filter(Boolean));
 }
 const placas=(rows as EntradaVeiculo[]).map(x=>x.placa).filter(Boolean);
 if(!placas.length)return new Set<string>();
 const result=await db.query(`SELECT placa FROM public.estoque_carros WHERE empresa_id=$1 AND
   REGEXP_REPLACE(UPPER(COALESCE(placa,'')),'[^A-Z0-9]','','g')=ANY($2::text[])`,[empresaId,placas]);
 return new Set<string>(result.rows.map((r:any)=>normalPlate(r.placa)).filter(Boolean));
}

export async function POST(req:NextRequest){
 const u=await requireUser(req);if(!u)return RESP({error:'Não autenticado'},401);
 const role=String(u.tipo).toLowerCase();if(!ROLES.includes(role))return RESP({error:'Sem permissão'},403);
 if(Number(req.headers.get('content-length')||'0')>4*1024*1024)return RESP({error:'Arquivo muito grande (máximo 3 MB).'},413);
 let form:FormData;
 try{form=await req.formData();}catch{return RESP({error:'Envie um arquivo válido.'},400);}
 const file=form.get('arquivo');
 if(!file||typeof file==='string')return RESP({error:'Selecione uma planilha CSV ou XLSX.'},400);
 const tipo=String(form.get('tipo')||'');if(tipo!=='leads'&&tipo!=='veiculos')return RESP({error:'Tipo inválido.'},400);
 if(tipo==='veiculos'&&role==='vendedor')return RESP({error:'Sem permissão para importar estoque.'},403);
 const acao=String(form.get('acao')||'preview');if(acao!=='preview'&&acao!=='confirmar')return RESP({error:'Ação inválida.'},400);
 const empresaId=role==='superadmin'?Number(form.get('empresa_id')):Number(u.empresa_id);
 const lojaPadrao=String(form.get('loja')||'').trim().toUpperCase();
 let linhas:string[][];
 try{linhas=await lerPlanilha(file as File);}catch(e){return RESP({error:e instanceof Error?e.message:'Falha ao ler planilha.'},400);}
 if(linhas.length<2)return RESP({error:'Planilha sem registros.'},400);
 let parsed:ReturnType<typeof processarLeads>|ReturnType<typeof processarVeiculos>;
 try{parsed=tipo==='leads'?processarLeads(linhas):processarVeiculos(linhas,lojaPadrao);}
 catch(e){return RESP({error:e instanceof Error?e.message:'Cabeçalhos incorretos.',colunas:linhas[0]},400);}
 const db=await getPool().connect();
 let transacao=false;
 try{
  await verificarEmpresa(db,empresaId,u);
  if(acao==='confirmar'){
   await db.query('BEGIN');transacao=true;
   // Evita importações concorrentes para a mesma empresa/tipo duplicarem registros.
   await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`aurox-importacao:${tipo}:${empresaId}`]);
   await verificarEmpresa(db,empresaId,u);
  }
  const validos=parsed.validos as (EntradaLead|EntradaVeiculo)[];
  const existentes=await pesquisarExistentes(db,tipo,empresaId,validos as any);
  const descartar=parsed.rejeitados.slice();
  const novos: (EntradaLead|EntradaVeiculo)[]=[];
  const lojas=tipo==='veiculos'?(await db.query('SELECT codigo FROM public.lojas WHERE empresa_id=$1 AND COALESCE(ativo,TRUE)',[empresaId])).rows.map((x:any)=>String(x.codigo).toUpperCase()):[];
  for(const row of validos){
   const chave=tipo==='leads'?(row as EntradaLead).telefone:(row as EntradaVeiculo).placa;
   if(chave&&existentes.has(chave)){descartar.push({linha:row.linha,motivo:tipo==='leads'?'Telefone já existe nesta empresa':'Placa já cadastrada nesta empresa'});continue;}
   if(tipo==='veiculos'&&!lojas.includes((row as EntradaVeiculo).patio)){
    descartar.push({linha:row.linha,motivo:'Loja não existe ou está inativa nesta empresa'});continue;
   }
   if(tipo==='veiculos'&&role==='gerente'&&(row as EntradaVeiculo).patio!==String(u.loja||'').toUpperCase()){
    descartar.push({linha:row.linha,motivo:'Loja fora do escopo do gerente'});continue;
   }
   novos.push(row);
  }
  if(acao==='preview')return RESP({ok:true,modo:'preview',tipo,total:linhas.length-1,validos:novos.length,ignorados:descartar.length,
     amostra:novos.slice(0,12),rejeitados:descartar.slice(0,70),cabecalho:linhas[0],aviso:'Prévia: nenhum dado foi gravado.'});
  if(novos.length){
   if(tipo==='leads'){
    const payload=(novos as EntradaLead[]).map(x=>({nome:x.nome,telefone:x.telefone,interesse:x.interesse,mensagem:x.mensagem}));
    await db.query(`INSERT INTO public.triagem (empresa_id,nome,telefone,interesse,origem,mensagem,status)
      SELECT $1,r.nome,r.telefone,NULLIF(r.interesse,''),'importacao-planilha',NULLIF(r.mensagem,''),'aguardando'
      FROM jsonb_to_recordset($2::jsonb) AS r(nome text,telefone text,interesse text,mensagem text)`,
      [empresaId,JSON.stringify(payload)]);
   }else{
    const payload=(novos as EntradaVeiculo[]).map(x=>({marca:x.marca,modelo:x.modelo,ano:x.ano,preco:x.preco,placa:x.placa||null,cor:x.cor,patio:x.patio,km:x.km??null,carroceria:x.carroceria||null,
      detalhes:{...(x.km===undefined?{}:{km:x.km}),...(x.carroceria?{carroceria:x.carroceria}:{}),...(x.observacoes?{observacoes:x.observacoes}:{})}}));
    await db.query(`INSERT INTO public.estoque_carros
      (empresa_id,marca,modelo,carro,placa,ano,cor,preco,patio,status,km,carroceria,aurox_detalhes)
      SELECT $1,r.marca,r.modelo,concat_ws(' ',r.marca,r.modelo),r.placa,r.ano,r.cor,r.preco,r.patio,
        'Disponível',r.km,r.carroceria,COALESCE(r.detalhes,'{}'::jsonb)
      FROM jsonb_to_recordset($2::jsonb) AS r(marca text,modelo text,placa text,ano integer,cor text,preco numeric,patio text,km integer,carroceria text,detalhes jsonb)`,
      [empresaId,JSON.stringify(payload)]);
   }
  }
  await db.query('COMMIT');transacao=false;
  console.info('[aurox importação]',{tipo,empresa_id:empresaId,linhas:linhas.length-1,inseridos:novos.length,ignorados:descartar.length});
  return RESP({ok:true,modo:'confirmar',tipo,inseridos:novos.length,ignorados:descartar.length,
    rejeitados:descartar.slice(0,70),aviso:tipo==='leads'?'Leads na triagem, sem mensagens automáticas.':'Veículos no estoque. Fotos podem ser associadas pela placa.'});
 }catch(e:any){if(transacao)await db.query('ROLLBACK').catch(()=>{});
  console.error('[aurox importação]',String(e?.code||'erro').slice(0,20));
  return RESP({error:'Importação não concluída. Nenhum registro do lote foi gravado.',detalhe:(e instanceof Error&&e.message.startsWith('Empresa'))?e.message:undefined},503);
 }finally{db.release();}
}
