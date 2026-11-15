import {createHmac, timingSafeEqual, createHash} from 'node:crypto';

/** Meta envia base64url(signature).base64url(payload), assinado com App Secret. */
export function verificarMetaSignedRequest(raw: string): {usuarioHash:string; emitidoEm:number} | null {
  const secret=process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET;
  if (!secret || raw.length>16000) return null;
  const parts=raw.split('.');
  if(parts.length!==2 || !parts.every(x=>/^[A-Za-z0-9_-]+$/.test(x))) return null;
  try {
    const [signature,payload]=parts;
    const received=Buffer.from(signature,'base64url');
    const expected=createHmac('sha256',secret).update(payload).digest();
    if(received.length!==expected.length || !timingSafeEqual(received,expected)) return null;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    if(String(data.algorithm||'').toUpperCase()!=='HMAC-SHA256')return null;
    if(typeof data.user_id!=='string' && typeof data.user_id!=='number') return null;
    const userId=String(data.user_id);
    if(!/^\d{1,40}$/.test(userId))return null;
    const when=Number(data.issued_at);
    const now=Math.floor(Date.now()/1000);
    if(!Number.isSafeInteger(when)||when>now+300||when<now-30*86400)return null;
    const usuarioHash=createHash('sha256').update(`meta:${userId}`).digest('hex');
    return {usuarioHash,emitidoEm:when};
  }catch{return null;}
}
