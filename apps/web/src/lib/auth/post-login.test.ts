import { describe, expect, it } from 'vitest';
import type { MeDto } from '@/lib/api/types';
import { resolvePostLogin, withNext } from './post-login';

const me = (role: MeDto['role']): MeDto => ({ id: '1', name: 'A', email: 'a@x', role, phone: null, rehabFollowupEnabled: false });

describe('resolvePostLogin', () => {
  it('honors a valid next for the role', () => {
    expect(resolvePostLogin(me('client'), '/performance')).toBe('/performance');
    expect(resolvePostLogin(me('staff'), '/staff/turnos')).toBe('/staff/turnos');
  });
  it('falls back to the role home', () => {
    expect(resolvePostLogin(me('client'), '/staff')).toBe('/perfil');
    expect(resolvePostLogin(me('staff'), null)).toBe('/staff');
    expect(resolvePostLogin(me('client'), 'https://evil.com')).toBe('/perfil');
  });
  it('rejects protocol-relative and backslash paths', () => {
    expect(resolvePostLogin(me('client'), '//evil.com')).toBe('/perfil');
    expect(resolvePostLogin(me('client'), '/\\evil.com')).toBe('/perfil');
    // Encoded slashes are not a protocol-relative URL: the browser keeps them as one path segment.
    expect(resolvePostLogin(me('client'), '/%2f%2fevil.com')).not.toMatch(/^\/\//);
    expect(resolvePostLogin(me('client'), '/%2f%2fevil.com')).toBe('/%2f%2fevil.com');
  });
  it('keeps the query string of an allowed next', () => {
    expect(resolvePostLogin(me('client'), '/planes?service=recovery')).toBe('/planes?service=recovery');
  });
  it('does not send staff to the client area or anyone back to the auth pages', () => {
    expect(resolvePostLogin(me('staff'), '/perfil')).toBe('/staff');
    expect(resolvePostLogin(me('client'), '/ingresar')).toBe('/perfil');
  });
  it('does not match prefixes by substring', () => {
    expect(resolvePostLogin(me('client'), '/staffing')).toBe('/staffing');
  });
  it('normalizes dot-segments before checking the role', () => {
    expect(resolvePostLogin(me('client'), '/perfil/../staff')).toBe('/perfil');
    expect(resolvePostLogin(me('staff'), '/staff/../perfil')).toBe('/staff');
    expect(resolvePostLogin(me('client'), '/a/..//evil.com')).toBe('/perfil');
    expect(resolvePostLogin(me('client'), '/a/b/../planes')).toBe('/a/planes');
  });
  it('never sends anyone back to an auth page, even through dot-segments', () => {
    for (const role of ['client', 'staff'] as const) {
      const home = role === 'client' ? '/perfil' : '/staff';
      for (const path of ['/ingresar', '/registro', '/recuperar', '/restablecer', '/continuar', '/./continuar', '/x/../ingresar', '/%2e/registro?next=%2F']) {
        expect(resolvePostLogin(me(role), path)).toBe(home);
      }
    }
  });
  it('rejects any backslash or control character', () => {
    expect(resolvePostLogin(me('client'), '/a\\b')).toBe('/perfil');
    expect(resolvePostLogin(me('client'), '/a\u007fb')).toBe('/perfil');
  });
});

describe('withNext', () => {
  it('appends an encoded next only when present', () => {
    expect(withNext('/registro', '/planes?service=recovery')).toBe('/registro?next=%2Fplanes%3Fservice%3Drecovery');
    expect(withNext('/registro', null)).toBe('/registro');
  });
});
