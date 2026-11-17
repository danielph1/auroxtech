import {randomBytes,createHmac,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import {getPool} from '@/lib/db';
import {extrairPlacas} from '@/lib/aurox-importacao-core';

export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
export const DRIVE_CALLBACK='/api/importacoes/drive/callback';
export const DRIVE_REDIRECT=()=>`${String(process.env.NEXT_PUBLIC_APP_URL||'').replace(/\/$/,'')}${DRIVE_CALLBACK}`;
function stateSecret(){const s=process.env.AUROX_DRIVE_STATE_SECRET;if(!s||s.length<32)throw new Error('Configure AUROX_DRIVE_STATE_SECRET com pelo menos 32 caracteres.');return s;}
function tokenKey(){const k=Buffer.from(process.env.AUROX_DRIVE_TOKEN_KEY||'','base64');if(k.length!==32)throw new Error('AUROX_DRIVE_TOKEN_KEY precisa conter 32 bytes em Base64.');return k;}
export function encryptToken(value:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',tokenKey(),iv);const ct=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ct.toString('base64url')].join('.');}
export function decryptToken(value:string){const [v,iv,tag,ct]=value.split('.');if(v!=='v1'||!iv||!tag||!ct)throw new Error('Token criptografado inválido.');const decipher=createDecipheriv('aes-256-gcm',tokenKey(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(ct,'base64url')),decipher.final()]).toString('utf8');}
export function makeState(empresaId:number,userId:number){const nonce=randomBytes(20).toString('hex'),payload=Buffer.from(JSON.stringify({n:nonce,e:empresaId,u:userId,t:Date.now()})).toString('base64url');const sig=createHmac('sha256',stateSecret()).update(payload).digest('base64url');return {nonce,state:`${payload}.${sig}`};}
export function parseState(value:string){const [p,sig]=value.split('.');if(!p||!sig)throw new Error('Estado OAuth inválido.');const x=createHmac('sha256',stateSecret()).update(p).digest();const y=Buffer.from(sig,'base64url');if(x.length!==y.length||!timingSafeEqual(x,y))throw new Error('Assinatura OAuth inválida.');const d=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));if(!/^[a-f0-9]{40}$/.test(d.n)||!Number.isSafeInteger(d.e)||!Number.isSafeInteger(d.u)||Math.abs(Date.now()-d.t)>10*60_000)throw new Error('Estado OAuth expirado.');return d as {n:string;e:number;u:number;t:number};}
export function credentials(){const id=process.env.GOOGLE_DRIVE_CLIENT_ID,secret=process.env.GOOGLE_DRIVE_CLIENT_SECRET,redirect=DRIVE_REDIRECT();if(!id||!secret||!redirect.startsWith('https://'))throw new Error('Configure GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET e NEXT_PUBLIC_APP_URL.');return {id,secret,redirect};}
export async function exchangeCode(code:string){const {id,secret,redirect}=credentials();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:id,client_secret:secret,redirect_uri:redirect,grant_type:'authorization_code',code}),headers:{'Content-Type':'application/x-www-form-urlencoded'},cache:'no-store'});const body=await r.json();if(!r.ok||typeof body.refresh_token!=='string')throw new Error('Google não forneceu refresh token. Reconecte autorizando acesso offline.');return body.refresh_token as string;}
export async function googleToken(empresaId:number){const db=await getPool().connect();let enc='';try{const {rows}=await db.query('SELECT refresh_token_enc FROM public.aurox_drive_conexoes WHERE empresa_id=$1',[empresaId]);enc=String(rows[0]?.refresh_token_enc||'');}finally{db.release();}if(!enc)throw new Error('Google Drive não conectado nesta empresa.');const refresh=decryptToken(enc),c=credentials();const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({client_id:c.id,client_secret:c.secret,refresh_token:refresh,grant_type:'refresh_token'}),headers:{'Content-Type':'application/x-www-form-urlencoded'},cache:'no-store'});const data=await r.json();if(!r.ok||!data.access_token)throw new Error('Autorização Google expirada. Reconecte o Drive.');return String(data.access_token);}
export function folderId(raw:unknown){const s=String(raw||'').trim();const id=/\/folders\/([\w-]{10,200})/.exec(s)?.[1]||(/^[-\w]{10,200}$/.test(s)?s:'');if(!id)throw new Error('Informe o link de uma pasta do Google Drive válida.');return id;}
type DriveFile={id:string;name:string;mimeType:string;size?:string};
export type DriveFoto=DriveFile&{pasta:string;placas:string[]};
async function driveJSON(url:string,token:string){const r=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!r.ok)throw new Error(`Google Drive recusou a leitura (${r.status}). Confira o acesso à pasta.`);return r.json();}
export async function listFotosDaPasta(token:string,root:string):Promise<DriveFoto[]>{
 const base='https://www.googleapis.com/drive/v3/files';
 const rootInfo=await driveJSON(`${base}/${encodeURIComponent(root)}?fields=id,name,mimeType,trashed&supportsAllDrives=true`,token);
 if(rootInfo.mimeType!=='application/vnd.google-apps.folder'||rootInfo.trashed)throw new Error('ID não corresponde a uma pasta acessível.');
 const folders:[string,string,number][]=[[root,String(rootInfo.name||''),0]];const photos:DriveFoto[]=[];let seen=0;
 while(folders.length&&seen<700){const [id,folder,depth]=folders.shift()!;let page='';
  do{const qs=new URLSearchParams({q:`'${id}' in parents and trashed=false`,pageSize:'100',fields:'nextPageToken,files(id,name,mimeType,size)',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(page)qs.set('pageToken',page);
   const data=await driveJSON(`${base}?${qs}`,token);for(const f of (data.files||[]) as DriveFile[]){seen++;
    if(f.mimeType==='application/vnd.google-apps.folder'&&depth<2)folders.push([f.id,`${folder}/${f.name}`,depth+1]);
    else if(['image/jpeg','image/png','image/webp'].includes(f.mimeType))photos.push({...f,pasta:folder,placas:[...new Set([...extrairPlacas(f.name),...extrairPlacas(folder)])]});
    if(seen>=700)break;
   }page=data.nextPageToken||'';
  }while(page&&seen<700);
 }
 return photos;
}
