import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, TEST_ORIGIN } from './utils/auth.js';
import { resetDb } from './utils/db.js';

// Runs the compiled CLI (`nest build` runs in the e2e global setup) against the test database (setup-env sets DB_NAME).
interface CliResult { code: number; stdout: string; stderr: string }

const runCli = (args: string[], env: Record<string, string> = {}): Promise<CliResult> =>
  new Promise((resolve) => {
    execFile(
      process.execPath,
      ['dist/cli/create-staff.js', ...args],
      { env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === 'number' ? error.code : -1;
        resolve({ code, stdout, stderr });
      },
    );
  });

const OLD_PASSWORD = 'Secreto123!';
const NEW_PASSWORD = 'NuevaClave456!';
const EXISTING_MESSAGE = 'Ya existe una cuenta con ese email; usá --promote-existing para convertirla en staff.';
const DELETED_MESSAGE = 'Ese email pertenece a una cuenta dada de baja; no se puede convertir en staff.';
const LONG_PASSWORD = `${'Clave1!'.repeat(18)}abc`;

describe('user:create-staff (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });

  const userRow = async (id: string): Promise<{ role: string; email_verified: boolean }> => {
    const [row] = await ctx.dataSource.query(`SELECT role, email_verified FROM users WHERE id = $1`, [id]);
    return row;
  };
  const sessionCount = async (id: string): Promise<number> => {
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM sessions WHERE user_id = $1`, [id]);
    return count;
  };
  const signIn = (email: string, password: string) => {
    const agent = request.agent(ctx.app.getHttpServer());
    return agent.post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email, password })
      .then((res) => ({ agent, status: res.status }));
  };
  const expectNoPassword = (result: CliResult, password: string) => {
    expect(result.stdout).not.toContain(password);
    expect(result.stderr).not.toContain(password);
  };

  it('creates a new staff user as before', async () => {
    const email = `nuevo-${randomUUID()}@test.move`;
    const result = await runCli(['--email', email, '--name', 'Staff Nuevo', '--password', NEW_PASSWORD]);
    expect(result.code).toBe(0);
    const [row] = await ctx.dataSource.query(
      `SELECT id, role, email_verified, created_at, updated_at FROM users WHERE email = $1`, [email],
    );
    expect(row.role).toBe('staff');
    expect(row.email_verified).toBe(false);
    // The role change goes through UsersService, which moves updated_at (raw SQL did not).
    expect(new Date(row.updated_at).getTime()).toBeGreaterThan(new Date(row.created_at).getTime());
    expect(result.stdout.trim()).toBe(`staff ${row.id}`);
    expectNoPassword(result, NEW_PASSWORD);
    const { agent, status } = await signIn(email, NEW_PASSWORD);
    expect(status).toBe(200);
    expect((await agent.get('/api/me').expect(200)).body.role).toBe('staff');
  });

  it('refuses an existing account without --promote-existing and changes nothing', async () => {
    const { agent, userId, email } = await signUp(ctx.app, { password: OLD_PASSWORD });
    const before = await userRow(userId);
    const sessions = await sessionCount(userId);

    const result = await runCli(['--email', email, '--name', 'Otro Nombre', '--password', NEW_PASSWORD]);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain(EXISTING_MESSAGE);
    expect(result.stdout).toBe('');
    expectNoPassword(result, NEW_PASSWORD);
    expect(await userRow(userId)).toEqual(before);
    expect(before.role).toBe('client');
    expect(await sessionCount(userId)).toBe(sessions);
    expect((await agent.get('/api/me').expect(200)).body.role).toBe('client');
    expect((await signIn(email, OLD_PASSWORD)).status).toBe(200);
    expect((await signIn(email, NEW_PASSWORD)).status).toBe(401);
  });

  it('promotes an existing account with --promote-existing: new password, sessions revoked, email verified', async () => {
    const { agent, userId, email } = await signUp(ctx.app, { password: OLD_PASSWORD });
    await signIn(email, OLD_PASSWORD);
    expect(await sessionCount(userId)).toBe(2);

    const result = await runCli(['--email', email, '--name', 'Staff', '--password', NEW_PASSWORD, '--promote-existing']);

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`Cuenta existente ${userId} convertida en staff; sesiones revocadas.`);
    expectNoPassword(result, NEW_PASSWORD);
    expect(await userRow(userId)).toEqual({ role: 'staff', email_verified: true });
    await agent.get('/api/me').expect(401);
    expect(await sessionCount(userId)).toBe(0);
    expect((await signIn(email, OLD_PASSWORD)).status).toBe(401);
    const fresh = await signIn(email, NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    expect((await fresh.agent.get('/api/me').expect(200)).body).toMatchObject({ id: userId, role: 'staff' });
  });

  it('creates the credential account when promoting a password-less account (CREATE_STAFF_PASSWORD)', async () => {
    const email = `invitado-${randomUUID()}@test.move`;
    const [{ id: userId }] = await ctx.dataSource.query(
      `INSERT INTO users (name, email, email_verified, role) VALUES ('Invitado', $1, false, 'client') RETURNING id`,
      [email],
    );

    const result = await runCli(
      ['--email', email.toUpperCase(), '--name', 'Invitado', '--promote-existing'],
      { CREATE_STAFF_PASSWORD: NEW_PASSWORD },
    );

    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toBe(`Cuenta existente ${userId} convertida en staff; sesiones revocadas.`);
    const accounts = await ctx.dataSource.query(
      `SELECT account_id FROM accounts WHERE user_id = $1 AND provider_id = 'credential'`, [userId],
    );
    expect(accounts).toEqual([{ account_id: userId }]);
    expect(await userRow(userId)).toEqual({ role: 'staff', email_verified: true });
    const fresh = await signIn(email, NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    expect((await fresh.agent.get('/api/me').expect(200)).body.role).toBe('staff');
  });

  it('refuses a soft-deleted account (D72), also with --promote-existing, and changes nothing', async () => {
    const { userId, email } = await signUp(ctx.app, { password: OLD_PASSWORD });
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [userId]);
    const snapshot = async () => ({
      users: await ctx.dataSource.query(`SELECT id, role, email_verified, deleted_at, updated_at FROM users ORDER BY id`),
      accounts: await ctx.dataSource.query(`SELECT id, password, updated_at FROM accounts ORDER BY id`),
      sessions: await sessionCount(userId),
    });
    const before = await snapshot();

    for (const extra of [[], ['--promote-existing']]) {
      const result = await runCli(['--email', email.toUpperCase(), '--name', 'Staff', '--password', NEW_PASSWORD, ...extra]);
      expect(result.code, extra.join(' ')).toBe(1);
      expect(result.stderr.trim()).toBe(DELETED_MESSAGE);
      expect(result.stdout).toBe('');
      expectNoPassword(result, NEW_PASSWORD);
    }
    expect(await snapshot()).toEqual(before);
  });

  it('rejects a 129-character password without printing it, for new and existing accounts', async () => {
    expect(LONG_PASSWORD).toHaveLength(129);
    const email = `largo-${randomUUID()}@test.move`;
    const created = await runCli(['--email', email, '--name', 'Staff Largo', '--password', LONG_PASSWORD]);
    expect(created.code).toBe(1);
    expectNoPassword(created, LONG_PASSWORD);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE email = $1`, [email]);
    expect(count).toBe(0);

    const { userId, email: existing } = await signUp(ctx.app, { password: OLD_PASSWORD });
    const promoted = await runCli(
      ['--email', existing, '--name', 'Staff', '--promote-existing'], { CREATE_STAFF_PASSWORD: LONG_PASSWORD },
    );
    expect(promoted.code).toBe(1);
    expectNoPassword(promoted, LONG_PASSWORD);
    expect(await userRow(userId)).toEqual({ role: 'client', email_verified: false });
    expect((await signIn(existing, OLD_PASSWORD)).status).toBe(200);
  });

  it('rejects a too-short password on promotion without changing anything', async () => {
    const { agent, userId, email } = await signUp(ctx.app, { password: OLD_PASSWORD });

    const result = await runCli(['--email', email, '--name', 'Staff', '--password', 'corta', '--promote-existing']);

    expect(result.code).toBe(1);
    expect(await userRow(userId)).toEqual({ role: 'client', email_verified: false });
    await agent.get('/api/me').expect(200);
    expect((await signIn(email, OLD_PASSWORD)).status).toBe(200);
  });
});
