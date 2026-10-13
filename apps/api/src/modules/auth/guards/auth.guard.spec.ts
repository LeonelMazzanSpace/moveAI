import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../../../common/auth/public.decorator.js';
import { ROLES_KEY } from '../../../common/auth/roles.decorator.js';
import { AuthGuard } from './auth.guard.js';

const makeContext = (req: Record<string, unknown>, meta: Record<string, unknown>): ExecutionContext => {
  const handler = () => undefined;
  Reflect.defineMetadata(IS_PUBLIC_KEY, meta[IS_PUBLIC_KEY], handler);
  Reflect.defineMetadata(ROLES_KEY, meta[ROLES_KEY], handler);
  return {
    getHandler: () => handler, getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
};

describe('AuthGuard', () => {
  const client = { id: 'u1', name: 'Ana', email: 'a@x', role: 'client', phone: null, rehabFollowupEnabled: false, createdAt: new Date() };
  const makeGuard = (sessionUserId: string | null, user: typeof client | null = client) =>
    new AuthGuard(
      new Reflector(),
      { api: { getSession: vi.fn().mockResolvedValue(sessionUserId ? { user: { id: sessionUserId } } : null) } } as never,
      { findById: vi.fn().mockResolvedValue(sessionUserId ? user : null) } as never,
    );

  it('rejects anonymous requests on protected routes', async () => {
    await expect(makeGuard(null).canActivate(makeContext({ headers: {} }, {}))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('allows anonymous requests on public routes', async () => {
    await expect(makeGuard(null).canActivate(makeContext({ headers: {} }, { [IS_PUBLIC_KEY]: true }))).resolves.toBe(true);
  });

  it('attaches the user on public routes when there is a session', async () => {
    const req: Record<string, unknown> = { headers: {} };
    await makeGuard('u1').canActivate(makeContext(req, { [IS_PUBLIC_KEY]: true }));
    expect(req.user).toEqual({ id: 'u1', name: 'Ana', email: 'a@x', role: 'client' });
  });

  it('forbids clients on staff routes', async () => {
    await expect(makeGuard('u1').canActivate(makeContext({ headers: {} }, { [ROLES_KEY]: ['staff'] })))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows staff on staff routes', async () => {
    const req: Record<string, unknown> = { headers: {} };
    const staff = { ...client, role: 'staff' };
    await expect(makeGuard('u1', staff).canActivate(makeContext(req, { [ROLES_KEY]: ['staff'] }))).resolves.toBe(true);
    expect(req.user).toMatchObject({ id: 'u1', role: 'staff' });
  });

  it('treats a session whose user is deleted or missing as anonymous', async () => {
    const req: Record<string, unknown> = { headers: {} };
    await expect(makeGuard('u1', null).canActivate(makeContext(req, {}))).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(makeGuard('u1', null).canActivate(makeContext(req, { [IS_PUBLIC_KEY]: true }))).resolves.toBe(true);
    expect(req.user).toBeUndefined();
  });
});
