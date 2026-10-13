import { Controller, Get } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { Public } from '../src/common/auth/public.decorator.js';
import { Roles } from '../src/common/auth/roles.decorator.js';
import { AuthService } from '../src/modules/auth/services/auth.service.js';
import { UsersService } from '../src/modules/users/services/users.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpStaff, TEST_ORIGIN } from './utils/auth.js';
import { resetDb } from './utils/db.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('auth (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });
  const http = () => request(ctx.app.getHttpServer());

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
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [email]);
      expect(count).toBe(0);
    }
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
