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
});

describe('withNext', () => {
  it('appends an encoded next only when present', () => {
    expect(withNext('/registro', '/planes?service=recovery')).toBe('/registro?next=%2Fplanes%3Fservice%3Drecovery');
    expect(withNext('/registro', null)).toBe('/registro');
  });
});
