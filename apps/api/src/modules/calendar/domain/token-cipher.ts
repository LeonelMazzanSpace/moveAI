import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

const assertKey = (key: Buffer): void => {
  if (key.length !== KEY_BYTES) throw new Error('calendar token key must be 32 bytes');
};

// AES-256-GCM with a random IV; stored as `iv:tag:ciphertext`, each part in base64.
export function encryptToken(plain: string, key: Buffer): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join(':');
}

// Throws when the value is malformed, the key is wrong or any part was altered (GCM authentication).
export function decryptToken(enc: string, key: Buffer): string {
  assertKey(key);
  const parts = enc.split(':');
  if (parts.length !== 3) throw new Error('malformed encrypted token');
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new Error('malformed encrypted token');
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
