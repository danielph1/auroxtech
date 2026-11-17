import {csvParaLinhas} from './aurox-importacao-core';

const MAX_BYTES=6*1024*1024;
const MAX_ROWS=1001; // cabeçalho + 1000 linhas
const MAX_COLS=40;
function verificarZipXlsx(buff:Buffer){
 // Central directory: rejeita ZIP bombs, entradas exageradas e formato ZIP64.
 let total=0,files=0,pos=0;
 while(pos+46<=buff.length){
  if(buff.readUInt32LE(pos)===0x02014b50){
   const unpacked=buff.readUInt32LE(pos+24),packed=buff.readUInt32LE(pos+20);
   if(unpacked===0xffffffff||packed===0xffffffff)throw new Error('XLSX com ZIP64 não é suportado.');
   total+=unpacked;files++;
   if(total>25*1024*1024||files>2000)throw new Error('XLSX excede limite de memória descompactada.');
   const nameLen=buff.readUInt16LE(pos+28),ext=buff.readUInt16LE(pos+30),comment=buff.readUInt16LE(pos+32);
   pos+=46+nameLen+ext+comment;
  }else pos++;
 }
 if(files<3)throw new Error('Estrutura XLSX inválida.');
}


/** Arquivos XLSX usam ExcelJS; instala-se a dependência pelo instalador. */
export async function lerPlanilha(file:File):Promise<string[][]>{
 if(file.size<1||file.size>MAX_BYTES)throw new Error('Arquivo vazio ou maior que 6 MB.');
 const name=file.name.toLowerCase();
 if(name.endsWith('.csv')){
  const buf=await file.arrayBuffer();
  let content:string;try{content=new TextDecoder('utf-8',{fatal:true}).decode(buf);}
  catch{content=new TextDecoder('windows-1252').decode(buf);}
  const linhas=csvParaLinhas(content);
  if(linhas.length>MAX_ROWS)throw new Error('Limite de 1.000 linhas. Divida a planilha.');
  if(linhas.some(r=>r.length>MAX_COLS))throw new Error('Máximo 40 colunas por planilha.');
  return linhas;
 }
 if(name.endsWith('.xlsx')){
  const buff=Buffer.from(await file.arrayBuffer());
  if(buff.subarray(0,2).toString('hex')!=='504b')throw new Error('XLSX inválido.');
  verificarZipXlsx(buff);
  const exceljs=(await import('exceljs')).default;
  const wb=new exceljs.Workbook();
  await wb.xlsx.load(buff as any);
  const ws=wb.worksheets[0];
  if(!ws)throw new Error('Planilha não contém abas.');
  if(ws.rowCount>MAX_ROWS||ws.columnCount>MAX_COLS)throw new Error('Limite de 1.000 linhas e 40 colunas.');
  const linhas:string[][]=[];
  for(let n=1;n<=ws.rowCount;n++){
   const row=ws.getRow(n);const line:string[]=[];
   for(let i=1;i<=Math.min(ws.columnCount,MAX_COLS);i++){
    const cell=row.getCell(i),v:any=cell.value;
    if(v==null)line.push('');
    else if(v instanceof Date)line.push(v.toISOString().slice(0,10));
    else if(typeof v==='object'){
     if(Array.isArray(v.richText))line.push(v.richText.map((z:any)=>String(z.text??'')).join('').slice(0,3000));
     else if(Object.hasOwn(v,'result'))line.push(String(v.result??'').slice(0,3000));
     else if(Object.hasOwn(v,'text'))line.push(String(v.text??'').slice(0,3000));
     else line.push(''); // não executa fórmulas, links ou objetos do Excel
    }else line.push(String(v).slice(0,3000));
   }
   linhas.push(line);
  }
  return linhas;
 }
 throw new Error('Envie um arquivo .csv ou .xlsx.');
}
