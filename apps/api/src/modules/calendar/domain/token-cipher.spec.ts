import { randomBytes } from 'node:crypto';
import { decryptToken, encryptToken } from './token-cipher.js';

const key = randomBytes(32);

// Replaces one base64 part of `iv:tag:ciphertext` with the same bytes with the first one flipped.
const tamper = (enc: string, part: 0 | 1 | 2): string => {
  const parts = enc.split(':');
  const bytes = Buffer.from(parts[part], 'base64');
  bytes[0] ^= 0xff;
  parts[part] = bytes.toString('base64');
  return parts.join(':');
};

describe('token cipher', () => {
  it('round-trips a token in the iv:tag:ciphertext format', () => {
    const enc = encryptToken('1//refresh-token', key);
    const [iv, tag, ciphertext] = enc.split(':');
    expect(Buffer.from(iv, 'base64')).toHaveLength(12);
    expect(Buffer.from(tag, 'base64')).toHaveLength(16);
    expect(ciphertext.length).toBeGreaterThan(0);
    expect(enc).not.toContain('refresh-token');
    expect(decryptToken(enc, key)).toBe('1//refresh-token');
  });

  it('uses a random iv for every encryption', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key));
  });

  it('fails when the tag, the iv or the ciphertext were altered', () => {
    const enc = encryptToken('1//refresh-token', key);
    expect(() => decryptToken(tamper(enc, 0), key)).toThrow();
    expect(() => decryptToken(tamper(enc, 1), key)).toThrow();
    expect(() => decryptToken(tamper(enc, 2), key)).toThrow();
  });

  it('fails with another key or a malformed value', () => {
    const enc = encryptToken('1//refresh-token', key);
    expect(() => decryptToken(enc, randomBytes(32))).toThrow();
    expect(() => decryptToken('not-encrypted', key)).toThrow();
    expect(() => decryptToken(`${enc}:extra`, key)).toThrow();
  });

  it('rejects keys that are not 32 bytes', () => {
    expect(() => encryptToken('x', randomBytes(16))).toThrow();
    expect(() => decryptToken(encryptToken('x', key), randomBytes(31))).toThrow();
  });
});
