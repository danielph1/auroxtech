import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function getKey(): Buffer {
  const raw = (process.env.META_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error('META_TOKEN_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais (32 bytes).');
  }
  return Buffer.from(raw, 'hex');
}

/** Tokens persistidos devem ser cifrados no servidor antes de ir para o PostgreSQL. */
export function encryptMetaToken(token: string): string {
  if (!token) throw new Error('Token Meta vazio');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptMetaToken(stored: string): string {
  const parts = String(stored || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Token legado sem criptografia: reconecte a conta Meta antes de enviar mensagens.');
  }
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
