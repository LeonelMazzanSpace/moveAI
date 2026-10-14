import { createHmac, randomBytes } from 'node:crypto';
import { OAUTH_STATE_TTL_MS, signState, verifyState } from './oauth-state.js';

const key = randomBytes(32);
const now = new Date('2026-10-14T15:00:00.000Z');
const payload = { staffId: 'staff-1', nonce: 'nonce-1', exp: now.getTime() + OAUTH_STATE_TTL_MS };

describe('oauth state', () => {
  it('accepts a state signed for the same staff before it expires', () => {
    expect(verifyState(signState(payload, key), key, 'staff-1', now)).toBe(true);
    expect(verifyState(signState(payload, key), key, 'staff-1', new Date(payload.exp - 1))).toBe(true);
  });

  it('rejects an expired state', () => {
    expect(verifyState(signState(payload, key), key, 'staff-1', new Date(payload.exp))).toBe(false);
  });

  it('rejects a state whose expiry is further away than the ttl', () => {
    const state = signState({ ...payload, exp: now.getTime() + OAUTH_STATE_TTL_MS + 60_000 }, key);
    expect(verifyState(state, key, 'staff-1', now)).toBe(false);
  });

  it('rejects the state of another staff', () => {
    expect(verifyState(signState(payload, key), key, 'staff-2', now)).toBe(false);
  });

  it('rejects an altered state', () => {
    const state = signState(payload, key);
    const [body, mac] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ ...payload, staffId: 'staff-2' })).toString('base64url');
    expect(verifyState(`${forged}.${mac}`, key, 'staff-2', now)).toBe(false);
    expect(verifyState(`${body}.${mac.slice(0, -2)}AA`, key, 'staff-1', now)).toBe(false);
    expect(verifyState(`${body}.`, key, 'staff-1', now)).toBe(false);
    expect(verifyState(body, key, 'staff-1', now)).toBe(false);
    expect(verifyState('', key, 'staff-1', now)).toBe(false);
  });

  it('rejects a state signed with another key', () => {
    expect(verifyState(signState(payload, randomBytes(32)), key, 'staff-1', now)).toBe(false);
  });

  it('does not sign with the token key itself', () => {
    const [body, mac] = signState(payload, key).split('.');
    expect(mac).not.toBe(createHmac('sha256', key).update(body).digest('base64url'));
  });
});
