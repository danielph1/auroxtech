import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(): Buffer {
  // Chave separada, ou derivação com separação de domínio da chave já protegida da Meta.
  const root = String(process.env.ML_TOKEN_ENCRYPTION_KEY || process.env.META_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!/^[a-f0-9]{64}$/i.test(root)) {
    throw new Error('Configure ML_TOKEN_ENCRYPTION_KEY (64 caracteres hex) no servidor.');
  }
  return createHash('sha256').update('aurox:mercadolivre:oauth:v1').update(Buffer.from(root, 'hex')).digest();
}

export function encryptMLToken(value: string): string {
  if (!value) throw new Error('Token Mercado Livre vazio');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['ml1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join(':');
}

export function decryptMLToken(value: string): string {
  const parts = String(value || '').split(':');
  if (parts[0] !== 'ml1' || parts.length !== 4) {
    throw new Error('Token Mercado Livre legado sem criptografia: reconecte a conta em Integrações.');
  }
  const [, iv, tag, data] = parts;
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
