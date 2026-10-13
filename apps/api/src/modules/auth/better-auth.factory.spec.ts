import { Logger } from '@nestjs/common';
import pg from 'pg';
import { createBetterAuth } from './better-auth.factory.js';

describe('createBetterAuth', () => {
  const pool = new pg.Pool({ max: 1 });
  afterAll(async () => { await pool.end(); });

  const make = (overrides: Partial<Parameters<typeof createBetterAuth>[0]> = {}) =>
    createBetterAuth({
      pool,
      secret: 'unit-test-secret-0123456789abcdef0123456789',
      baseURL: 'http://localhost:3001',
      webUrl: 'http://localhost:3000',
      cookieDomain: null,
      google: null,
      isProduction: false,
      sendResetPassword: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    });

  it('maps Better Auth models onto the snake_case tables', () => {
    const { options } = make();
    expect(options.user.modelName).toBe('users');
    expect(options.user.fields).toMatchObject({ emailVerified: 'email_verified', createdAt: 'created_at' });
    expect(options.session.modelName).toBe('sessions');
    expect(options.session.fields.userId).toBe('user_id');
    expect(options.account.modelName).toBe('accounts');
    expect(options.account.fields.providerId).toBe('provider_id');
    expect(options.verification.modelName).toBe('verifications');
    expect(options.verification.fields.expiresAt).toBe('expires_at');
    expect(options.advanced.database?.generateId).toBe('uuid');
  });

  it('keeps the role out of client input and defaults it to client', () => {
    const { role } = make().options.user.additionalFields;
    expect(role).toMatchObject({ input: false, defaultValue: 'client' });
  });

  it('links Google to the existing account and does not require email verification', () => {
    const { options } = make();
    expect(options.account.accountLinking.trustedProviders).toContain('google');
    expect(options.emailAndPassword.requireEmailVerification).toBe(false);
    expect(options.basePath).toBe('/api/auth');
    expect(options.trustedOrigins).toContain('http://localhost:3000');
  });

  it('enables Google only when credentials are given', () => {
    expect(make().options.socialProviders).not.toHaveProperty('google');
    const google = { clientId: 'id', clientSecret: 'shh' };
    expect(make({ google }).options.socialProviders).toHaveProperty('google');
  });

  it('hardens the endpoints: no update-user, origin checks always on, sessions revoked on reset', () => {
    const { options } = make();
    expect(options.disabledPaths).toContain('/update-user');
    expect(options.advanced.disableOriginCheck).toBe(false);
    expect(options.emailAndPassword.revokeSessionsOnPasswordReset).toBe(true);
    expect(options.emailAndPassword.onPasswordReset).toBeTypeOf('function');
  });

  it('forwards only the log message to Nest, never the extra arguments', () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    make().options.logger.log?.('error', 'Failed to create user', new Error('Key (email)=(a@x) already exists'));
    expect(error).toHaveBeenCalledWith('Failed to create user');
    error.mockRestore();
  });

  it('uses secure and cross-subdomain cookies when configured', () => {
    expect(make().options.advanced).toMatchObject({ useSecureCookies: false });
    expect(make().options.advanced.crossSubDomainCookies).toBeUndefined();
    const { advanced } = make({ isProduction: true, cookieDomain: 'move.uy' }).options;
    expect(advanced).toMatchObject({ useSecureCookies: true, crossSubDomainCookies: { enabled: true, domain: 'move.uy' } });
  });
});
