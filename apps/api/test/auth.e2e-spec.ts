import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/common/auth/public.decorator.js';
import { Roles } from '../src/common/auth/roles.decorator.js';
import { BETTER_AUTH } from '../src/modules/auth/auth.constants.js';
import type { BetterAuthInstance } from '../src/modules/auth/better-auth.factory.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { UsersService } from '../src/modules/users/services/users.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpStaff, TEST_ORIGIN } from './utils/auth.js';
import { resetDb } from './utils/db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

describe('auth (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });
  const http = () => request(ctx.app.getHttpServer());
  const expectResetLinkLasts = async (hours: number) => {
    const [row] = await ctx.dataSource.query(
      `SELECT expires_at FROM verifications WHERE identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1`,
    );
    const remaining = new Date(row.expires_at).getTime() - Date.now();
    expect(remaining).toBeGreaterThan(hours * HOUR_MS - MINUTE_MS);
    expect(remaining).toBeLessThanOrEqual(hours * HOUR_MS + MINUTE_MS);
  };

  it('signs up as client and reads /me', async () => {
    const { agent, email } = await signUp(ctx.app, { name: 'Martina Suárez' });
    const me = await agent.get('/api/me').expect(200);
    expect(me.body).toMatchObject({ name: 'Martina Suárez', email, role: 'client', phone: null, rehabFollowupEnabled: false });
  });

  it('cannot choose role on sign-up', async () => {
    const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
      .send({ name: 'X', email: 'x@test.move', password: 'Secreto123!', role: 'staff' });
    const [row] = await ctx.dataSource.query(`SELECT role FROM users WHERE email = 'x@test.move'`);
    expect(res.status === 200 ? row.role : 'client').toBe('client');
  });

  it('rejects anonymous /me with the error envelope', async () => {
    const res = await http().get('/api/me').expect(401);
    expect(res.body).toEqual({ statusCode: 401, code: 'UNAUTHENTICATED', message: 'Tenés que iniciar sesión.' });
  });

  it('keeps one account per email (case-insensitive)', async () => {
    await signUp(ctx.app, { email: 'Ana@Test.move' });
    const dup = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
      .send({ name: 'Ana 2', email: 'ana@test.move', password: 'Secreto123!' }).expect(422);
    expect(String(dup.body.code)).toMatch(/^USER_ALREADY_EXISTS/);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE LOWER(email) = 'ana@test.move'`);
    expect(count).toBe(1);
  });

  it('signs out', async () => {
    const { agent } = await signUp(ctx.app);
    await agent.post('/api/auth/sign-out').set('Origin', TEST_ORIGIN).expect(200);
    await agent.get('/api/me').expect(401);
  });

  it('signs in with email and password and keeps the session cookie', async () => {
    const { email } = await signUp(ctx.app);
    const agent = request.agent(ctx.app.getHttpServer());
    await agent.post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email, password: 'wrong-password' }).expect(401);
    await agent.get('/api/me').expect(401);
    await agent.post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email, password: 'Secreto123!' }).expect(200);
    expect((await agent.get('/api/me').expect(200)).body.email).toBe(email);
  });

  it('stores Better Auth data in the snake_case tables with uuid ids', async () => {
    const { userId } = await signUp(ctx.app);
    expect(userId).toMatch(UUID);
    const [account] = await ctx.dataSource.query(`SELECT id, provider_id FROM accounts WHERE user_id = $1`, [userId]);
    expect(account).toMatchObject({ provider_id: 'credential' });
    expect(account.id).toMatch(UUID);
    const [session] = await ctx.dataSource.query(`SELECT id FROM sessions WHERE user_id = $1`, [userId]);
    expect(session.id).toMatch(UUID);
  });

  it('treats a soft-deleted user as anonymous', async () => {
    const { agent, userId } = await signUp(ctx.app);
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [userId]);
    await agent.get('/api/me').expect(401);
  });

  it('updates the profile', async () => {
    const { agent } = await signUp(ctx.app);
    const res = await agent.patch('/api/me').send({ phone: '099123456' }).expect(200);
    expect(res.body.phone).toBe('099123456');
    await agent.patch('/api/me').send({ role: 'staff' }).expect(400);
  });

  it('patches only the given fields and validates them', async () => {
    const { agent } = await signUp(ctx.app, { name: 'Martina Suárez' });
    await agent.patch('/api/me').send({ phone: '099123456' }).expect(200);
    const renamed = await agent.patch('/api/me').send({ name: 'Martina S.' }).expect(200);
    expect(renamed.body).toMatchObject({ name: 'Martina S.', phone: '099123456' });
    const cleared = await agent.patch('/api/me').send({ phone: null }).expect(200);
    expect(cleared.body).toMatchObject({ name: 'Martina S.', phone: null });
    for (const body of [{ name: null }, { name: 'M' }, { phone: '123' }, { phone: 99123456 }]) {
      const res = await agent.patch('/api/me').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
  });

  it('trims profile fields and rejects NUL bytes or blank names on PATCH /me', async () => {
    const { agent } = await signUp(ctx.app);
    const padded = await agent.patch('/api/me').send({ name: '  Ana Pérez  ', phone: ' 099123456 ' }).expect(200);
    expect(padded.body).toMatchObject({ name: 'Ana Pérez', phone: '099123456' });
    for (const body of [{ name: 'Ana\u0000B' }, { phone: '099\u0000123456' }, { name: '     ' }, { phone: '      ' }]) {
      const res = await agent.patch('/api/me').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
    expect((await agent.get('/api/me').expect(200)).body).toMatchObject({ name: 'Ana Pérez', phone: '099123456' });
  });

  it('rejects unpaired UTF-16 surrogates on PATCH /me (D120)', async () => {
    const { agent } = await signUp(ctx.app, { name: 'Ana Pérez' });
    for (const body of [{ name: 'Ana\ud800' }, { name: '\udc00Ana' }, { phone: '0991\ud8002345' }]) {
      const res = await agent.patch('/api/me').send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    }
    expect((await agent.get('/api/me').expect(200)).body).toMatchObject({ name: 'Ana Pérez', phone: null });
  });

  it('signs up with a phone and stores trimmed profile fields', async () => {
    const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
      .send({ name: '  Ana Pérez  ', email: 'phone@test.move', password: 'Secreto123!', phone: ' 099123456 ' }).expect(200);
    const [user] = await ctx.dataSource.query(`SELECT name, phone FROM users WHERE id = $1`, [res.body.user.id]);
    expect(user).toEqual({ name: 'Ana Pérez', phone: '099123456' });
  });

  it('rejects invalid sign-up names and phones without creating the user', async () => {
    const invalid = [
      { name: '' }, { name: '   ' }, { name: 'n'.repeat(81) }, { name: 'Ana\u0000B' },
      { phone: '123' }, { phone: '9'.repeat(21) }, { phone: '099\u0000123456' }, { phone: 99123456 },
    ];
    for (const [index, override] of invalid.entries()) {
      const email = `invalid-${index}@test.move`;
      const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
        .send({ name: 'Ana Pérez', email, password: 'Secreto123!', ...override });
      expect(res.status, JSON.stringify(override)).toBe(400);
      expect(res.body.code, JSON.stringify(override)).toBe('VALIDATION_FAILED');
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [email]);
      expect(count).toBe(0);
    }
  });

  it('rejects sign-up images and out-of-bounds emails without creating the user', async () => {
    const invalid = [
      { image: 'https://example.com/a.png' }, { image: 'javascript:alert(1)' }, { image: 'x'.repeat(60_000) }, { image: '' },
      { email: `${'a'.repeat(245)}@test.move` }, { email: 'a\u0000b@test.move' }, { email: 12345 }, { email: '   ' },
    ];
    for (const override of invalid) {
      const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
        .send({ name: 'Ana Pérez', email: 'image@test.move', password: 'Secreto123!', ...override });
      expect(res.status, JSON.stringify(override).slice(0, 80)).toBe(400);
      expect(res.body.code, JSON.stringify(override).slice(0, 80)).toBe('VALIDATION_FAILED');
    }
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users`);
    expect(count).toBe(0);
  });

  it('trims the sign-up email and stores it lowercased', async () => {
    const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
      .send({ name: 'Ana Pérez', email: '  Trim@Test.move  ', password: 'Secreto123!' }).expect(200);
    const [user] = await ctx.dataSource.query(`SELECT email, image FROM users WHERE id = $1`, [res.body.user.id]);
    expect(user).toEqual({ email: 'trim@test.move', image: null });
  });

  it('does not expose Better Auth update-user (PATCH /me is the profile path)', async () => {
    const { agent, userId } = await signUp(ctx.app, { name: 'Martina Suárez' });
    await agent.post('/api/auth/update-user').set('Origin', TEST_ORIGIN).send({ name: 'Otro', phone: '1'.repeat(3000) }).expect(404);
    const [user] = await ctx.dataSource.query(`SELECT name, phone FROM users WHERE id = $1`, [userId]);
    expect(user).toEqual({ name: 'Martina Suárez', phone: null });
  });

  it('rejects auth request bodies over 64 KB with 413', async () => {
    const body = JSON.stringify({ name: 'n'.repeat(70_000), email: 'big@test.move', password: 'Secreto123!' });
    await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).set('Content-Type', 'application/json')
      .send(body).expect(413);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users`);
    expect(count).toBe(0);
  });

  it('rejects chunked auth request bodies with 413 without logging an error', async () => {
    const errorLog = vi.spyOn(Logger.prototype, 'error');
    const server = createServer(ctx.app.getHttpAdapter().getInstance());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const body = JSON.stringify({ name: 'Ana Pérez', email: 'chunked@test.move', password: 'Secreto123!', image: 'x'.repeat(70_000) });
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = httpRequest({
          host: '127.0.0.1', port, method: 'POST', path: '/api/auth/sign-up/email',
          headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked', Origin: TEST_ORIGIN },
        }, (response) => {
          let text = '';
          response.setEncoding('utf8').on('data', (chunk: string) => { text += chunk; })
            .on('end', () => resolve({ status: response.statusCode ?? 0, body: text }));
        });
        req.on('error', reject);
        for (let offset = 0; offset < body.length; offset += 8_192) req.write(body.slice(offset, offset + 8_192));
        req.end();
      });
      expect(res.status).toBe(413);
      expect(JSON.parse(res.body)).toEqual({ statusCode: 413, code: 'VALIDATION_FAILED', message: 'Los datos enviados no son válidos.' });
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users`);
      expect(count).toBe(0);
      expect(errorLog).not.toHaveBeenCalled();
    } finally {
      errorLog.mockRestore();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects untrusted password reset redirects', async () => {
    const { email } = await signUp(ctx.app);
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email, redirectTo: 'https://evil.example/x' }).expect(403);
  });

  it('revokes existing sessions and verifies the email after a password reset', async () => {
    const { agent, email, userId } = await signUp(ctx.app);
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email, redirectTo: `${TEST_ORIGIN}/restablecer` }).expect(200);
    const [verification] = await ctx.dataSource.query(`SELECT identifier FROM verifications ORDER BY created_at DESC LIMIT 1`);
    const token = String(verification.identifier).replace(/^reset-password:/, '');
    await http().post('/api/auth/reset-password').set('Origin', TEST_ORIGIN).send({ newPassword: 'NuevaClave123!', token }).expect(200);
    await agent.get('/api/me').expect(401);
    const [user] = await ctx.dataSource.query(`SELECT email_verified FROM users WHERE id = $1`, [userId]);
    expect(user.email_verified).toBe(true);
  });

  it('invites a user who then sets a password through the reset flow', async () => {
    const { userId } = await ctx.app.get(AuthService).createInvitedUser({ name: 'Lucía Pereira', email: 'lu@test.move' });
    const [log] = await ctx.dataSource.query(`SELECT template, user_id, idempotency_key FROM email_logs`);
    expect(log.template).toBe('account-invitation');
    const [verification] = await ctx.dataSource.query(`SELECT identifier FROM verifications ORDER BY created_at DESC LIMIT 1`);
    const token = String(verification.identifier).replace(/^reset-password:/, '');
    expect(log.idempotency_key).not.toContain(token);
    await http().post('/api/auth/reset-password').set('Origin', TEST_ORIGIN).send({ newPassword: 'NuevaClave123!', token }).expect(200);
    const login = request.agent(ctx.app.getHttpServer());
    await login.post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email: 'lu@test.move', password: 'NuevaClave123!' }).expect(200);
    expect((await login.get('/api/me').expect(200)).body.id).toBe(userId);
  });

  it('gives invitation links 72 hours and password reset links 1 hour (D71)', async () => {
    await ctx.app.get(AuthService).createInvitedUser({ name: 'Lucía Pereira', email: 'lu72@test.move' });
    await expectResetLinkLasts(72);
    const { email } = await signUp(ctx.app);
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email, redirectTo: `${TEST_ORIGIN}/restablecer` }).expect(200);
    await expectResetLinkLasts(1);
  });

  it('sends the 72-hour invitation again when an invited user asks for a password reset', async () => {
    await ctx.app.get(AuthService).createInvitedUser({ name: 'Lucía Pereira', email: 'lu-again@test.move' });
    await ctx.dataSource.query('DELETE FROM verifications');
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email: 'lu-again@test.move', redirectTo: `${TEST_ORIGIN}/restablecer` }).expect(200);
    const templates = await ctx.dataSource.query(`SELECT template FROM email_logs ORDER BY created_at`);
    expect(templates).toEqual([{ template: 'account-invitation' }, { template: 'account-invitation' }]);
    await expectResetLinkLasts(72);
  });

  // A transient DB error while extending the link must not leave a created user without an invitation.
  it('still emails the invitation, with the 1-hour link, when extending it to 72 hours fails', async () => {
    const adapter = (await ctx.app.get<BetterAuthInstance>(BETTER_AUTH).$context).internalAdapter;
    const extend = vi.spyOn(adapter, 'updateVerificationByIdentifier').mockRejectedValueOnce(new Error('connection reset'));
    const logged = [vi.spyOn(Logger.prototype, 'warn'), vi.spyOn(Logger.prototype, 'error')];
    try {
      const { userId } = await ctx.app.get(AuthService).createInvitedUser({ name: 'Lucía Pereira', email: 'lu-extend@test.move' });
      expect(extend).toHaveBeenCalledTimes(1);
      const logs = await ctx.dataSource.query(`SELECT template, user_id AS "userId" FROM email_logs`);
      expect(logs).toEqual([{ template: 'account-invitation', userId }]);
      await expectResetLinkLasts(1);
      const lines = logged.flatMap((spy) => spy.mock.calls.map((call) => call.map(String).join(' ')));
      expect(lines.some((line) => line.includes(userId))).toBe(true);
      expect(lines.join('\n')).not.toMatch(/lu-extend|connection reset|reset-password/);
    } finally {
      extend.mockRestore();
      logged.forEach((spy) => spy.mockRestore());
    }
  });

  it('caps the stored User-Agent at 512 characters', async () => {
    const res = await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN).set('User-Agent', 'a'.repeat(2000))
      .send({ name: 'Ana Pérez', email: 'ua@test.move', password: 'Secreto123!' }).expect(200);
    const [session] = await ctx.dataSource.query(
      `SELECT length(user_agent)::int AS length FROM sessions WHERE user_id = $1`, [res.body.user.id],
    );
    expect(session.length).toBe(512);
  });

  it('creates invited users as password-less clients', async () => {
    const { userId } = await ctx.app.get(AuthService).createInvitedUser({ name: 'Lucía', email: 'Lu2@Test.move', phone: '099111222' });
    const [user] = await ctx.dataSource.query(`SELECT email, role, phone FROM users WHERE id = $1`, [userId]);
    expect(user).toEqual({ email: 'lu2@test.move', role: 'client', phone: '099111222' });
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM accounts WHERE user_id = $1`, [userId]);
    expect(count).toBe(0);
    const [log] = await ctx.dataSource.query(`SELECT user_id, status FROM email_logs`);
    expect(log).toEqual({ user_id: userId, status: 'skipped' });
  });

  it('rejects inviting an existing email', async () => {
    await signUp(ctx.app, { email: 'dup@test.move' });
    await expect(ctx.app.get(AuthService).createInvitedUser({ name: 'D', email: 'DUP@test.move' }))
      .rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('trims invited user input and rejects NUL bytes', async () => {
    const auth = ctx.app.get(AuthService);
    const { userId } = await auth.createInvitedUser({ name: '  Lucía  ', email: ' lu3@test.move ', phone: ' 099111222 ' });
    const [user] = await ctx.dataSource.query(`SELECT name, email, phone FROM users WHERE id = $1`, [userId]);
    expect(user).toEqual({ name: 'Lucía', email: 'lu3@test.move', phone: '099111222' });
    for (const input of [
      { name: 'Lu\u0000cía', email: 'lu4@test.move' }, { name: ' ', email: 'lu4@test.move' },
      { name: 'Lucía', email: 'lu\u00004@test.move' }, { name: 'Lucía', email: 'lu4@test.move', phone: '12' },
    ]) {
      await expect(auth.createInvitedUser(input)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    }
    await expect(auth.emailExists('lu\u00004@test.move')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('counts soft-deleted users as existing emails', async () => {
    const { userId } = await signUp(ctx.app, { email: 'gone@test.move' });
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [userId]);
    const auth = ctx.app.get(AuthService);
    await expect(auth.emailExists('Gone@Test.move')).resolves.toBe(true);
    await expect(auth.createInvitedUser({ name: 'Gone', email: 'gone@test.move' })).rejects.toMatchObject({ code: 'EMAIL_ALREADY_REGISTERED' });
  });

  it('sends password-reset to users with a password without storing the token', async () => {
    const { email, userId } = await signUp(ctx.app);
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email, redirectTo: `${TEST_ORIGIN}/restablecer` }).expect(200);
    const [log] = await ctx.dataSource.query(`SELECT template, user_id, idempotency_key FROM email_logs`);
    expect(log).toMatchObject({ template: 'password-reset', user_id: userId });
    const [verification] = await ctx.dataSource.query(`SELECT identifier FROM verifications ORDER BY created_at DESC LIMIT 1`);
    const token = String(verification.identifier).replace(/^reset-password:/, '');
    expect(log.idempotency_key).toMatch(/^password-reset:[0-9a-f]{16}$/);
    expect(log.idempotency_key).not.toContain(token);
  });

  it('answers password reset for unknown emails without sending anything', async () => {
    await http().post('/api/auth/request-password-reset').set('Origin', TEST_ORIGIN)
      .send({ email: 'nadie@test.move', redirectTo: `${TEST_ORIGIN}/restablecer` }).expect(200);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM email_logs`);
    expect(count).toBe(0);
  });
});

describe('UsersService (e2e)', () => {
  let ctx: TestApp;
  let users: UsersService;
  beforeAll(async () => { ctx = await createTestApp(); users = ctx.app.get(UsersService); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });
  // Compared inside Postgres, at full precision: a write in the same millisecond as the previous one cannot flake.
  const updatedAt = async (id: string): Promise<string> =>
    (await ctx.dataSource.query(`SELECT updated_at::text AS at FROM users WHERE id = $1`, [id]))[0].at;
  const movedSince = async (id: string, at: string): Promise<boolean> =>
    (await ctx.dataSource.query(`SELECT updated_at > $2::timestamptz AS moved FROM users WHERE id = $1`, [id, at]))[0].moved;

  it('lists clients by name, without staff or deleted users', async () => {
    const bruno = await signUp(ctx.app, { name: 'Bruno' });
    const ana = await signUp(ctx.app, { name: 'Ana' });
    const deleted = await signUp(ctx.app, { name: 'Carla' });
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [deleted.userId]);
    await signUpStaff(ctx.app, ctx.dataSource);
    expect((await users.listClients()).map((user) => user.id)).toEqual([ana.userId, bruno.userId]);
  });

  it('finds users by ids', async () => {
    const ana = await signUp(ctx.app, { name: 'Ana' });
    const bruno = await signUp(ctx.app, { name: 'Bruno' });
    await signUp(ctx.app, { name: 'Carla' });
    const found = await users.findByIds([ana.userId, bruno.userId]);
    expect(found.map((user) => user.id).sort()).toEqual([ana.userId, bruno.userId].sort());
    await expect(users.findByIds([])).resolves.toEqual([]);
  });

  it('sets rehab follow-up, also inside a transaction, and fails for unknown users', async () => {
    const { userId } = await signUp(ctx.app);
    await expect(users.setRehabFollowupEnabled(userId, true)).resolves.toMatchObject({ id: userId, rehabFollowupEnabled: true });
    await ctx.dataSource.transaction((manager) => users.setRehabFollowupEnabled(userId, false, manager));
    expect((await users.findById(userId))?.rehabFollowupEnabled).toBe(false);
    await expect(users.setRehabFollowupEnabled('00000000-0000-4000-8000-000000000000', true))
      .rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('promotes a user to staff with a verified email inside the given transaction', async () => {
    const { userId } = await signUp(ctx.app);
    const other = await signUp(ctx.app);
    const [promotedBefore, otherBefore] = [await updatedAt(userId), await updatedAt(other.userId)];
    await ctx.dataSource.transaction((manager) => users.promoteToStaff(manager, userId));
    const rows = await ctx.dataSource.query(
      `SELECT id, role, email_verified FROM users WHERE id IN ($1, $2)`, [userId, other.userId],
    );
    expect(rows).toEqual(expect.arrayContaining([
      { id: userId, role: 'staff', email_verified: true },
      { id: other.userId, role: 'client', email_verified: false },
    ]));
    expect(await movedSince(userId, promotedBefore)).toBe(true);
    expect(await movedSince(other.userId, otherBefore)).toBe(false);
    await expect(ctx.dataSource.transaction(async (manager) => {
      await users.promoteToStaff(manager, other.userId);
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect((await users.findById(other.userId))?.role).toBe('client');
  });

  it('sets only the staff role inside the given transaction and moves updated_at', async () => {
    const { userId } = await signUp(ctx.app);
    const before = await updatedAt(userId);
    await ctx.dataSource.transaction((manager) => users.setStaffRole(manager, userId));
    const [after] = await ctx.dataSource.query(`SELECT role, email_verified FROM users WHERE id = $1`, [userId]);
    expect(after).toEqual({ role: 'staff', email_verified: false });
    expect(await movedSince(userId, before)).toBe(true);
    await ctx.dataSource.query(`UPDATE users SET role = 'client' WHERE id = $1`, [userId]);
    await expect(ctx.dataSource.transaction(async (manager) => {
      await users.setStaffRole(manager, userId);
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect((await users.findById(userId))?.role).toBe('client');
  });
});

@Controller('auth-probe')
class ProbeController {
  @Get('staff') @Roles('staff') staff() { return { ok: true }; }
  @Get('client') @Roles('client') client() { return { ok: true }; }
  @Get('public') @Public() publicRoute() { return { ok: true }; }
}

describe('role guard (e2e)', () => {
  let app: NestExpressApplication;
  let ctx: TestApp;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    ctx = { app, dataSource: app.get(DataSource) };
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });

  it('answers 401 without session and 403 for clients on staff routes', async () => {
    await request(app.getHttpServer()).get('/api/auth-probe/staff').expect(401);
    const { agent } = await signUp(app);
    const res = await agent.get('/api/auth-probe/staff').expect(403);
    expect(res.body).toEqual({ statusCode: 403, code: 'FORBIDDEN', message: 'No tenés permiso para esta acción.' });
    await agent.get('/api/auth-probe/client').expect(200);
  });

  it('lets staff in, reading the role from users', async () => {
    const { agent } = await signUpStaff(app, ctx.dataSource);
    await agent.get('/api/auth-probe/staff').expect(200);
    await agent.get('/api/auth-probe/client').expect(403);
  });

  it('keeps public routes open', async () => {
    await request(app.getHttpServer()).get('/api/auth-probe/public').expect(200);
  });
});
