/** Cifras e regras puras do portal de fichas. Somente ambiente Node.js. */
import 'server-only';
import {randomBytes, randomInt, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import sharp from 'sharp';

function secret(): Buffer {
 const s=process.env.AUROX_FICHA_PORTAL_SECRET || '';
 if (!/^[0-9a-f]{64,}$/i.test(s) || s.length%2) throw new Error('AUROX_FICHA_PORTAL_SECRET: gerar 32 bytes aleatorios em hex');
 return Buffer.from(s,'hex');
}
export function novoToken(): string { return randomBytes(32).toString('base64url'); }
export function tokenValido(t: unknown): t is string {return typeof t==='string' && /^[a-zA-Z0-9_-]{43}$/.test(t);}
export function hashToken(t:string):string {return createHash('sha256').update(t).digest('hex');}
export function novoCodigo():string{return String(randomInt(0,1_000_000)).padStart(6,'0');}
export function confirmarConfiguracao():void {void secret();}
export function hashCodigo(tokenHash:string,codigo:string):string{
 return createHmac('sha256',createHmac('sha256',secret()).update('ficha-otp-v1').digest()).update(`${tokenHash}:${codigo}`).digest('hex');
}
export function verificaCodigo(tokenHash:string,codigo:string,esperado:string|null):boolean{
 if(!esperado||!/^[0-9]{6}$/.test(codigo))return false;
 const actual=Buffer.from(hashCodigo(tokenHash,codigo),'hex');
 const expected=Buffer.from(esperado,'hex');
 return expected.length===actual.length && timingSafeEqual(actual,expected);
}
function encryptionKey():Buffer{return createHmac('sha256',secret()).update('ficha-dados-v1').digest();}
export function cifrarDados(dados:unknown):string{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const plain=Buffer.from(JSON.stringify(dados),'utf8');
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}
export function decifrarDados(raw:string):Record<string,unknown>{
 const [v,iv,tag,body]=String(raw).split('.');
 if(v!=='v1'||!iv||!tag||!body)throw Error('Resposta ilegivel');
 const dc=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64url'));
 dc.setAuthTag(Buffer.from(tag,'base64url'));
 return JSON.parse(Buffer.concat([dc.update(Buffer.from(body,'base64url')),dc.final()]).toString('utf8'));
}
export function cpfValido(cpf:string):boolean{
 const n=cpf.replace(/\D/g,'');if(n.length!==11||/^(\d)\1{10}$/.test(n))return false;
 for(let pos=9;pos<=10;pos++){
  const sum=n.slice(0,pos).split('').reduce((a,d,i)=>a+Number(d)*(pos+1-i),0);
  const digit=(sum*10)%11%10;if(digit!==Number(n[pos]))return false;
 }return true;
}
export const respostaSchema=z.object({
 nome_completo:z.string().trim().min(5).max(150),
 telefone:z.string().trim().regex(/^[+()0-9\s-]{10,24}$/),
 carro_interesse:z.string().trim().min(2).max(150),
 valor_entrada:z.string().trim().regex(/^\d{1,9}(?:[,.]\d{1,2})?$/),
 cpf:z.string().transform(v=>v.replace(/\D/g,'')).refine(cpfValido,'CPF inválido'),
 data_nascimento:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{
  const d=new Date(`${s}T12:00:00Z`);if(Number.isNaN(d.getTime())||d.toISOString().slice(0,10)!==s)return false;
  const today=new Date(), youngest=new Date(Date.UTC(today.getUTCFullYear()-18,today.getUTCMonth(),today.getUTCDate()));
  return d<=youngest&&d>=new Date('1900-01-01T00:00:00Z');
 },'É necessário ter pelo menos 18 anos'),
 rg:z.string().trim().max(30).optional().default(''),
 nome_mae:z.string().trim().max(150).optional().default(''),
 email:z.union([z.literal(''),z.string().email().max(200)]).optional().default(''),
 cep:z.string().trim().max(12).optional().default(''),
 endereco:z.string().trim().max(220).optional().default(''),
 bairro:z.string().trim().max(120).optional().default(''),
 cidade:z.string().trim().max(120).optional().default(''),
 estado:z.union([z.literal(''),z.string().regex(/^[A-Z]{2}$/)]).optional().default(''),
 salario:z.union([z.literal(''),z.string().regex(/^\d{1,9}(?:[,.]\d{1,2})?$/)]).optional().default(''),
 consentimento:z.literal(true),
}).strict();
export type RespostaCliente=z.infer<typeof respostaSchema>;
export function urlPublicaFicha(token:string):string{
 const raw=process.env.AUROX_PUBLIC_URL||'https://auroxtech.vercel.app';
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('AUROX_PUBLIC_URL precisa ser origem HTTPS confiavel');
 // Fragmento nunca e enviado no GET da pagina, logs e Referer.
 return `${u.origin}/ficha-cliente#${token}`;
}
export async function parseLogo(raw:unknown):Promise<string|null>{
 if(raw===null||raw===''||raw===undefined)return null;
 if(typeof raw!=='string'||raw.length>165000)throw Error('Logo excessiva');
 const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw);
 if(!m)throw Error('Use imagem PNG, JPEG ou WebP');
 const b=Buffer.from(m[2],'base64');
 if(b.length>110_000||b.length<16)throw Error('Logo deve ter ate 110 KB');
 const png=b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const jpeg=b.subarray(0,3).equals(Buffer.from([255,216,255]));
 const webp=b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
 if(!(m[1]==='png'&&png||m[1]==='jpeg'&&jpeg||m[1]==='webp'&&webp))throw Error('Conteudo da imagem nao corresponde ao formato');
 const optimized=await sharp(b,{limitInputPixels:4_000_000}).rotate().resize({width:420,height:145,fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer();
 if(optimized.length>110000)throw Error('Logo processada excede o limite de 110 KB');
 return `data:image/png;base64,${optimized.toString('base64')}`;
}
export const temaSchema=z.object({
 titulo:z.string().trim().min(5).max(90),
 mensagem:z.string().trim().max(280),
 cor_primaria:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 cor_fundo:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 cor_texto:z.string().regex(/^#[0-9a-fA-F]{6}$/),
 logo_data_uri:z.unknown(),
 campanha:z.enum(['institucional','promocao','feirao','natal','ofertao']),
 modo_banner:z.enum(['nenhum','estatico','carrossel']),
 banners:z.array(z.number().int().min(0).max(3)).max(3).refine(v=>new Set(v).size===v.length),
 empresa_nome:z.string().max(150).optional(),
}).strict();
export {TEMA_PADRAO} from './ficha-portal-tema';
