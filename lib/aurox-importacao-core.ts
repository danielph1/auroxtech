/** Normalização determinística de planilhas AUROX. Sem acesso ao banco ou dados de outra empresa. */
export type Registro = Record<string, string>;
export type EntradaLead = { nome: string; telefone: string; interesse: string; mensagem: string; linha: number };
export type EntradaVeiculo = { marca: string; modelo: string; ano: number; preco: number; placa: string; cor: string; km?: number; carroceria?: string; patio: string; observacoes?: string; linha: number };
export type Rejeitado = { linha: number; motivo: string };
export type Mapeamento = Record<string, number>;

const nomesCampos: Record<string, string[]> = {
 nome: ['nome','nome completo','nome do cliente','nome lead','cliente','cliente nome','contato nome','responsavel','lead','name','full name','customer name'],
 telefone: ['telefone','telefone celular','telefone 1','numero telefone','numero de telefone','celular','fone','fone 1','whatsapp','numero whatsapp','telefone whatsapp','mobile','phone','phone number','tel','contato','contato telefone'],
 interesse: ['interesse','produto interesse','produto de interesse','veiculo interesse','veiculo desejado','carro interesse','modelo interesse'],
 observacao: ['observacao','observacoes','obs','mensagem','comentario','comentarios','descricao','notes','message'],
 email: ['email','e mail','endereco email'],
 origem: ['origem','fonte','canal','source'],
 marca: ['marca','fabricante','montadora','make'],
 modelo: ['modelo','veiculo','carro','model'],
 ano: ['ano','ano fabricacao','ano de fabricacao','ano fab','year'],
 preco: ['preco','preco venda','valor','valor venda','preco anunciado','price'],
 placa: ['placa','placa veiculo','placa do veiculo','license plate'],
 km: ['km','quilometragem','odometro'],
 cor: ['cor','color'],
 carroceria: ['carroceria','categoria','body type'],
 patio: ['patio','loja','codigo loja','unidade','filial']
};
function ascii(s: string) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); }
export function detectarMapeamento(cabecalho:string[]):Mapeamento {
 const norm=cabecalho.map(ascii);const m:Mapeamento={};
 for(const [campo,sinonimos] of Object.entries(nomesCampos)){
  let i=norm.findIndex(x=>sinonimos.includes(x));
  if(i===-1){
   if(campo==='nome')i=norm.findIndex(x=>x.startsWith('nome do ')||x.startsWith('nome de ')||x.startsWith('nome '));
   if(campo==='telefone')i=norm.findIndex(x=>/^(telefone|celular|whatsapp|fone)( |$)/.test(x)||x.startsWith('numero telefone'));
   if(campo==='preco')i=norm.findIndex(x=>x.startsWith('preco ')||x.startsWith('valor de venda'));
  }
  if(i!==-1)m[campo]=i;
 }
 return m;
}
export function csvParaLinhas(text:string):string[][] {
 const content=text.replace(/^\uFEFF/,'');
 if(Buffer.byteLength(content,'utf8')>6*1024*1024)throw new Error('Arquivo CSV grande demais (máximo 6 MB).');
 // Detecta delimitador sem contar separadores dentro de aspas.
 const first=content.split(/\r?\n/,1)[0]||'';
 const count=(c:string)=>{let inside=false,n=0;for(let i=0;i<first.length;i++){if(first[i]==='"'){if(inside&&first[i+1]==='"'){i++;continue;}inside=!inside;}else if(!inside&&first[i]===c)n++;}return n;};
 const sep=[';',',','\t'].sort((a,b)=>count(b)-count(a))[0];
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<content.length;i++){
  const c=content[i];
  if(c==='"'){
   if(quoted&&content[i+1]==='"'){cell+='"';i++;}
   else quoted=!quoted;
  }else if(c===sep&&!quoted){row.push(cell.trim());cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&content[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell='';if(rows.length>1002)throw new Error('Limite de 1.000 linhas de dados por arquivo.');}
  else cell+=c;
 }
 if(quoted)throw new Error('CSV contém aspas sem fechamento.');
 row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 return rows;
}
export function normalizarTelefone(raw:unknown):string|null {
 let d=String(raw??'').replace(/\D/g,'');
 if((d.length===12||d.length===13)&&d.startsWith('55'))d=d.slice(2);
 if(!/^\d{10,11}$/.test(d))return null;
 const ddd=Number(d.slice(0,2));if(ddd<11||ddd>99)return null;
 if(/^([0-9])\1+$/.test(d.slice(2)))return null;
 return d;
}
export function extrairPlacas(texto:unknown):string[] {
 const s=String(texto??'').toUpperCase();const encontrados:string[]=[];
 // Antigo ABC-1234 e Mercosul ABC1D23; exclui fragmentos de palavras/IDs maiores.
 const re=/(^|[^A-Z0-9])([A-Z]{3})[-\s]?([0-9])([A-J0-9])([0-9]{2})(?=$|[^A-Z0-9])/g;
 for(const m of s.matchAll(re)){const placa=`${m[2]}${m[3]}${m[4]}${m[5]}`;if(!encontrados.includes(placa))encontrados.push(placa);}
 return encontrados;
}
export function normalizarPreco(v:unknown):number|null {
 const s=String(v??'').replace(/[^\d,.-]/g,'').trim();if(!s)return null;
 let t=s;
 if(t.includes(',')&&t.includes('.'))t=t.lastIndexOf(',')>t.lastIndexOf('.')?t.replace(/\./g,'').replace(',','.'):t.replace(/,/g,'');
 else if(t.includes(','))t=t.replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'');
 const n=Number(t);return Number.isFinite(n)&&n>0&&n<=1_000_000_000?Math.round(n*100)/100:null;
}
function get(row:string[],map:Mapeamento,key:string){const i=map[key];return i===undefined?'':String(row[i]??'').trim();}
function safe(v:string,n=160){return v.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);}
export function processarLeads(linhas:string[][],mapping?:Mapeamento){
 const cabecalho=linhas[0]||[];const map=mapping||detectarMapeamento(cabecalho);
 if(map.nome===undefined||map.telefone===undefined)throw new Error('Não encontramos as colunas Nome e Telefone. Renomeie os cabeçalhos ou selecione as colunas correspondentes.');
 const validos:EntradaLead[]=[],rejeitados:Rejeitado[]=[],vistos=new Set<string>();
 for(let i=1;i<linhas.length;i++){
  const row=linhas[i];if(!row?.some(c=>String(c).trim()))continue;
  const nome=safe(get(row,map,'nome'),140),telefone=normalizarTelefone(get(row,map,'telefone'));
  if(!nome){rejeitados.push({linha:i+1,motivo:'Nome ausente'});continue;}
  if(!telefone){rejeitados.push({linha:i+1,motivo:'Telefone ausente ou inválido'});continue;}
  if(vistos.has(telefone)){rejeitados.push({linha:i+1,motivo:'Telefone repetido na planilha'});continue;}
  vistos.add(telefone);
  const interesse=safe(get(row,map,'interesse'),240),observacao=safe(get(row,map,'observacao'),800);
  const email=safe(get(row,map,'email'),120),origem=safe(get(row,map,'origem'),100);
  const mensagem=[observacao, email?`E-mail: ${email}`:'',origem?`Origem original: ${origem}`:''].filter(Boolean).join('\n').slice(0,1600);
  validos.push({nome,telefone,interesse,mensagem,linha:i+1});
 }
 return {cabecalho,validos,rejeitados};
}
export function processarVeiculos(linhas:string[][],lojaPadrao:string,mapping?:Mapeamento){
 const cabecalho=linhas[0]||[];const map=mapping||detectarMapeamento(cabecalho);
 for(const key of ['marca','modelo','ano','preco','placa'])if(map[key]===undefined)throw new Error(`Coluna obrigatória não encontrada: ${key}.`);
 const validos:EntradaVeiculo[]=[],rejeitados:Rejeitado[]=[],vistos=new Set<string>();
 for(let i=1;i<linhas.length;i++){
  const row=linhas[i];if(!row?.some(c=>String(c).trim()))continue;
  const marca=safe(get(row,map,'marca'),90),modelo=safe(get(row,map,'modelo'),120);
  const ano=Number(get(row,map,'ano')),preco=normalizarPreco(get(row,map,'preco'));
  const agora=new Date().getUTCFullYear();
  if(marca.length<2||modelo.length<2||!Number.isInteger(ano)||ano<1900||ano>agora+2||preco===null){rejeitados.push({linha:i+1,motivo:'Marca, modelo, ano ou preço inválido'});continue;}
  const rawPlate=get(row,map,'placa');const placa=extrairPlacas(rawPlate)[0]||'';
  if(!placa){rejeitados.push({linha:i+1,motivo:rawPlate?'Placa inválida':'Placa obrigatória'});continue;}
  if(vistos.has(placa)){rejeitados.push({linha:i+1,motivo:'Placa repetida na planilha'});continue;}
  if(placa)vistos.add(placa);
  const patio=safe(get(row,map,'patio')||lojaPadrao,30).toUpperCase();
  if(!patio){rejeitados.push({linha:i+1,motivo:'Loja obrigatória'});continue;}
  const kmRaw=get(row,map,'km');let km:number|undefined;
  if(kmRaw){const digits=kmRaw.replace(/[^0-9]/g,'');km=Number(digits);if(!Number.isSafeInteger(km)||km<0){rejeitados.push({linha:i+1,motivo:'Quilometragem inválida'});continue;}}
  validos.push({marca,modelo,ano,preco,placa,cor:safe(get(row,map,'cor'),60),km,carroceria:safe(get(row,map,'carroceria'),100),patio,observacoes:safe(get(row,map,'observacao'),1200),linha:i+1});
 }
 return {cabecalho,validos,rejeitados};
}
