import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto';

export const OAUTH_STATE_TTL_MS = 10 * 60_000;
const HKDF_INFO = 'move-calendar-oauth-state';

// `exp` is a Unix time in milliseconds.
export interface OAuthStatePayload { staffId: string; nonce: string; exp: number }

// The HMAC key is derived from CALENDAR_TOKEN_KEY, so the token encryption key is never used for anything else.
const stateKey = (tokenKey: Buffer): Buffer =>
  Buffer.from(hkdfSync('sha256', tokenKey, Buffer.alloc(0), HKDF_INFO, 32));

const mac = (body: string, tokenKey: Buffer): Buffer => createHmac('sha256', stateKey(tokenKey)).update(body).digest();

const isPayload = (value: unknown): value is OAuthStatePayload => {
  if (typeof value !== 'object' || value === null) return false;
  const { staffId, nonce, exp } = value as Record<string, unknown>;
  return typeof staffId === 'string' && typeof nonce === 'string' && typeof exp === 'number';
};

const parseBody = (body: string): unknown => {
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

// `<base64url(json)>.<base64url(hmac-sha256)>`.
export function signState(payload: OAuthStatePayload, tokenKey: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(body, tokenKey).toString('base64url')}`;
}

// Valid only with an untouched signature, the same staff and an expiry in the next OAUTH_STATE_TTL_MS.
export function verifyState(state: string, tokenKey: Buffer, staffId: string, now: Date): boolean {
  const parts = state.split('.');
  if (parts.length !== 2) return false;
  const [body, signature] = parts;
  const expected = mac(body, tokenKey);
  const given = Buffer.from(signature, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;

  const payload = parseBody(body);
  if (!isPayload(payload) || payload.staffId !== staffId) return false;
  return payload.exp > now.getTime() && payload.exp <= now.getTime() + OAUTH_STATE_TTL_MS;
}
