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
    await http().post('/api/auth/sign-up/email').set('Origin', TEST_ORIGIN)
      .send({ name: 'Ana 2', email: 'ana@test.move', password: 'Secreto123!' });
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
