import {randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {NextRequest,NextResponse} from 'next/server';
import {getPool} from '@/lib/db';
import {supabaseAdmin} from '@/lib/supabase';
import {conferirAcessoDrive} from '@/lib/aurox-drive-access';
import {folderId,googleToken,listFotosDaPasta} from '@/lib/aurox-drive';
import {extrairPlacas} from '@/lib/aurox-importacao-core';
export const runtime='nodejs';export const dynamic='force-dynamic';
const resp=(obj:object,code=200)=>NextResponse.json(obj,{status:code,headers:{'Cache-Control':'no-store'}});

async function vincular(empresaId:number,token:string,folder:string){
 const fotos=await listFotosDaPasta(token,folder);
 const db=await getPool().connect();try{
  const {rows}=await db.query(`SELECT id,placa FROM public.estoque_carros WHERE empresa_id=$1 AND placa IS NOT NULL AND trim(placa)<>''`,[empresaId]);
  const byPlate=new Map<string,number[]>();for(const r of rows){const plate=extrairPlacas(r.placa)[0];if(plate)byPlate.set(plate,[...(byPlate.get(plate)||[]),Number(r.id)]);}
  const vistos=await db.query(`SELECT drive_file_id,carro_id FROM public.aurox_drive_fotos WHERE empresa_id=$1 AND status='done'`,[empresaId]);
  const known=new Set(vistos.rows.map((r:any)=>`${r.drive_file_id}:${r.carro_id}`));
  return fotos.map(f=>{
   const cars=[...new Set(f.placas.flatMap(x=>byPlate.get(x)||[]))];
   const carroId=cars.length===1?cars[0]:null;
   const motivo=!f.placas.length?'Sem placa no nome ou na pasta':cars.length===0?'Placa não encontrada no estoque':cars.length>1?'Associação ambígua':known.has(`${f.id}:${carroId}`)?'Já importada':'';
   return {...f,carroId,motivo};
  });
 }finally{db.release();}
}
export async function GET(req:NextRequest){
 const empresaId=Number(req.nextUrl.searchParams.get('empresa_id'));
 try{await conferirAcessoDrive(req,empresaId);const db=await getPool().connect();try{
  const {rows}=await db.query('SELECT atualizado_em FROM public.aurox_drive_conexoes WHERE empresa_id=$1',[empresaId]);
  return resp({conectado:rows.length>0,atualizado_em:rows[0]?.atualizado_em||null});
 }finally{db.release();}}
 catch(e){return resp({error:e instanceof Error?e.message:'Sem permissão.'},403);}
}
export async function DELETE(req:NextRequest){
 const empresaId=Number(req.nextUrl.searchParams.get('empresa_id'));
 try{await conferirAcessoDrive(req,empresaId);const db=await getPool().connect();try{
  await db.query('DELETE FROM public.aurox_drive_conexoes WHERE empresa_id=$1',[empresaId]);
  return resp({ok:true});
 }finally{db.release();}}
 catch{return resp({error:'Não foi possível desconectar.'},403);}
}
export async function POST(req:NextRequest){
 let body:any;try{body=await req.json();}catch{return resp({error:'Informe a pasta do Google Drive.'},400);}
 const empresaId=Number(body?.empresa_id);
 try{await conferirAcessoDrive(req,empresaId);}catch{return resp({error:'Empresa fora do seu escopo.'},403);}
 let folder:string;
 try{folder=folderId(body?.pasta);}catch(e){return resp({error:e instanceof Error?e.message:'Pasta inválida.'},400);}
 const acao=body?.acao;if(acao!=='preview'&&acao!=='sincronizar')return resp({error:'Ação inválida.'},400);
 try{
  const token=await googleToken(empresaId);const fotos=await vincular(empresaId,token,folder);
  const elegiveis=fotos.filter(f=>!!f.carroId&&!f.motivo);
  if(acao==='preview')return resp({ok:true,total:fotos.length,elegiveis:elegiveis.length,pendentes:fotos.filter(f=>f.motivo).length,
    amostra:fotos.slice(0,45).map(f=>({nome:f.name,placa:f.placas.join(', '),carro_id:f.carroId,motivo:f.motivo}))});
  const resultado={importadas:0,ignoradas:0,falhas:0,mensagens:[] as string[]};
  // Lotes conservadores: até 8 imagens por chamada para caber no runtime da Vercel.
  for(const foto of elegiveis.slice(0,8)){
   const db=await getPool().connect();let claimId:number|null=null,storagePath:string|null=null;
   try{
    await db.query("DELETE FROM public.aurox_drive_fotos WHERE empresa_id=$1 AND status='processing' AND criado_em<now()-interval '15 minutes'",[empresaId]);
    const {rows:[claimed]}=await db.query(`INSERT INTO public.aurox_drive_fotos(empresa_id,drive_file_id,carro_id,status)
      VALUES($1,$2,$3,'processing') ON CONFLICT DO NOTHING RETURNING id`,[empresaId,foto.id,foto.carroId]);
    if(!claimed){resultado.ignoradas++;continue;}
    claimId=Number(claimed.id);
    const own=await db.query('SELECT 1 FROM public.estoque_carros WHERE id=$1 AND empresa_id=$2',[foto.carroId,empresaId]);
    const count=await db.query('SELECT COUNT(*)::int AS n FROM public.estoque_fotos WHERE carro_id=$1',[foto.carroId]);
    if(!own.rowCount||Number(count.rows[0].n)>=20){resultado.ignoradas++;await db.query('DELETE FROM public.aurox_drive_fotos WHERE id=$1',[claimId]);continue;}
    if(Number(foto.size||0)>12*1024*1024){resultado.ignoradas++;await db.query('DELETE FROM public.aurox_drive_fotos WHERE id=$1',[claimId]);continue;}
    const res=await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(foto.id)}?alt=media&supportsAllDrives=true`,
      {headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:AbortSignal.timeout(12_000)});
    if(!res.ok)throw new Error('Falha ao ler foto autorizada no Google Drive.');
    const buffer=Buffer.from(await res.arrayBuffer());if(buffer.length>12*1024*1024)throw new Error('Foto muito grande.');
    const image=await sharp(buffer,{limitInputPixels:45_000_000}).rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).webp({quality:77}).toBuffer();
    if(image.length>1.5*1024*1024)throw new Error('Foto continua grande após compressão.');
    storagePath=`estoque/${foto.carroId}/${Date.now()}_${randomBytes(5).toString('hex')}.webp`;
    const {error}=await supabaseAdmin.storage.from('manu_arquivos').upload(storagePath,image,{contentType:'image/webp',upsert:false});
    if(error)throw new Error('Não foi possível salvar foto no Storage.');
    const url=supabaseAdmin.storage.from('manu_arquivos').getPublicUrl(storagePath).data.publicUrl;
    await db.query('BEGIN');
    const check=await db.query('SELECT 1 FROM public.estoque_carros WHERE id=$1 AND empresa_id=$2 FOR UPDATE',[foto.carroId,empresaId]);
    const quota=await db.query('SELECT COUNT(*)::int AS n FROM public.estoque_fotos WHERE carro_id=$1',[foto.carroId]);
    if(!check.rowCount||Number(quota.rows[0].n)>=20)throw new Error('Veículo removido ou limite de fotos atingido.');
    await db.query(`INSERT INTO public.estoque_fotos(carro_id,path,url,ordem,created_by)
      VALUES($1,$2,$3,COALESCE((SELECT MAX(ordem)+1 FROM public.estoque_fotos WHERE carro_id=$1),0),NULL)`,[foto.carroId,storagePath,url]);
    await db.query('UPDATE public.aurox_drive_fotos SET status=$2,path=$3 WHERE id=$1',[claimId,'done',storagePath]);
    await db.query('COMMIT');resultado.importadas++;
   }catch(e){await db.query('ROLLBACK').catch(()=>{});resultado.falhas++;
    if(claimId)await db.query("DELETE FROM public.aurox_drive_fotos WHERE id=$1 AND status='processing'",[claimId]).catch(()=>{});
    if(storagePath)await supabaseAdmin.storage.from('manu_arquivos').remove([storagePath]).catch(()=>{});
    resultado.mensagens.push(e instanceof Error?e.message:'Falha ao importar imagem.');
   }finally{db.release();}
  }
  return resp({ok:true,...resultado,restantes:Math.max(0,elegiveis.length-8),aviso:'Execute novamente para importar mais fotos (máximo 8 por vez).'});
 }catch(e){console.error('[drive sync]',e instanceof Error?e.message:'erro');return resp({error:e instanceof Error?e.message:'Falha na integração Google Drive.'},503);}
}
