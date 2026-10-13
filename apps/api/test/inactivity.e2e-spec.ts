import request from 'supertest';
import { addDays, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { AlertsService } from '../src/modules/followup/services/alerts.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { givePerformancePlan } from './utils/fixtures.js';

describe('inactivity reasons (e2e)', () => {
  let ctx: TestApp;
  let staff: { agent: TestAgent; userId: string };
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => {
    await resetDb(ctx.dataSource);
    await seedCatalogAndSchedule(ctx.dataSource);
    staff = await signUpStaff(ctx.app, ctx.dataSource);
  });

  const today = () => businessToday();
  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
  const startPath = (userId: string) => `/api/staff/clients/${userId}/inactivity-reasons`;
  const endPath = (userId: string) => `/api/staff/clients/${userId}/inactivity-reasons/end`;

  async function insertAlert(userId: string, type: string, periodKey: string): Promise<string> {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO followup_alerts (user_id, type, period_key) VALUES ($1, $2, $3) RETURNING id`,
      [userId, type, periodKey],
    );
    return row.id as string;
  }
  const statusOf = async (alertId: string): Promise<string> =>
    (await ctx.dataSource.query(`SELECT status FROM followup_alerts WHERE id = $1`, [alertId]))[0].status as string;

  async function waitForLockWaiters(expected: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const [{ waiting }] = await ctx.dataSource.query(
        `SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
      );
      if (waiting >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`expected ${expected} backends waiting on a lock`);
  }

  it('opens a pause and handles the open inactivity, frequency and expiry alerts of the client', async () => {
    const client = await signUpClient(ctx.app);
    const other = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 30) });
    await ctx.app.get(AlertsService).detectAlerts(today());
    const [{ id: noAttendance }] = await ctx.dataSource.query(`SELECT id FROM followup_alerts WHERE type = 'no_attendance'`);
    const handledTypes = ['prolonged_inactivity', 'frequency_drop', 'expiring', 'expired'];
    const others = await Promise.all(handledTypes.map((type) => insertAlert(client.userId, type, `test:${type}`)));
    const pain = await insertAlert(client.userId, 'checkin_pain', 'checkin:x');
    const recontact = await insertAlert(client.userId, 'recontact', 'reason:x');
    const otherClient = await insertAlert(other.userId, 'no_attendance', 'since:x');

    const res = await staff.agent.post(startPath(client.userId))
      .send({ reason: 'injury', note: '  Lesión de rodilla  ', recontactOn: addDays(today(), 14) }).expect(201);
    expect(res.body).toEqual({
      id: expect.any(String), reason: 'injury', note: 'Lesión de rodilla', recontactOn: addDays(today(), 14),
      startedAt: expect.any(String), endedAt: null, createdByName: 'Usuario Test',
    });

    for (const id of [noAttendance, ...others]) expect(await statusOf(id)).toBe('handled');
    for (const id of [pain, recontact, otherClient]) expect(await statusOf(id)).toBe('open');
    const [handled] = await ctx.dataSource.query(`SELECT handled_by AS "handledBy" FROM followup_alerts WHERE id = $1`, [noAttendance]);
    expect(handled.handledBy).toBe(staff.userId);
  });

  it('allows one active pause per client and closes it once', async () => {
    const client = await signUpClient(ctx.app);
    await staff.agent.post(startPath(client.userId)).send({ reason: 'vacation' }).expect(201)
      .expect((r) => expect(r.body).toMatchObject({ note: null, recontactOn: null }));
    await staff.agent.post(startPath(client.userId)).send({ reason: 'no_time' }).expect(409).expect(expectCode('PAUSE_ALREADY_ACTIVE'));

    const ended = await staff.agent.post(endPath(client.userId)).expect(200);
    expect(ended.body).toMatchObject({ reason: 'vacation', endedAt: expect.any(String) });
    await staff.agent.post(endPath(client.userId)).expect(409).expect(expectCode('NO_ACTIVE_PAUSE'));

    await staff.agent.post(startPath(client.userId)).send({ reason: 'moving' }).expect(201);
    const rows = await ctx.dataSource.query(`SELECT reason, ended_at IS NULL AS active FROM inactivity_reasons ORDER BY started_at`);
    expect(rows).toEqual([{ reason: 'vacation', active: false }, { reason: 'moving', active: true }]);
  });

  // Barrier: an open transaction holds the client's active-pause key, so both requests are seen waiting on it before it
  // rolls back.
  it('answers PAUSE_ALREADY_ACTIVE to one of two concurrent pauses', async () => {
    const client = await signUpClient(ctx.app);
    const holder = ctx.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    let pending: Promise<request.Response[]> | undefined;
    try {
      await holder.query(
        `INSERT INTO inactivity_reasons (user_id, reason, created_by) VALUES ($1, 'moving', $2)`,
        [client.userId, staff.userId],
      );
      pending = Promise.all([
        staff.agent.post(startPath(client.userId)).send({ reason: 'injury' }),
        staff.agent.post(startPath(client.userId)).send({ reason: 'vacation' }),
      ]);
      await waitForLockWaiters(2);
    } catch (error) {
      await holder.rollbackTransaction();
      await holder.release();
      await Promise.allSettled([pending]);
      throw error;
    }
    await holder.rollbackTransaction();
    await holder.release();
    const results = (await pending) ?? [];
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('PAUSE_ALREADY_ACTIVE');
    const rows = await ctx.dataSource.query(`SELECT reason FROM inactivity_reasons WHERE ended_at IS NULL`);
    expect(rows).toEqual([{ reason: results.find((r) => r.status === 201)?.body.reason }]);
  });

  it('validates the reason, note and recontact date', async () => {
    const client = await signUpClient(ctx.app);
    const past = await staff.agent.post(startPath(client.userId)).send({ reason: 'injury', recontactOn: addDays(today(), -1) })
      .expect(400).expect(expectCode('VALIDATION_FAILED'));
    expect(past.body.details).toEqual([{ field: 'recontactOn', messages: [expect.any(String)] }]);

    for (const body of [
      {}, { reason: 'sick' }, { reason: null }, { reason: 'injury', recontactOn: '2026-13-45' }, { reason: 'injury', recontactOn: '01/11/2026' },
      { reason: 'injury', recontactOn: null }, { reason: 'injury', note: null }, { reason: 'injury', note: 'x'.repeat(1001) },
      { reason: 'injury', note: 'a\u0000b' }, { reason: 'injury', extra: true },
    ]) {
      await staff.agent.post(startPath(client.userId)).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
    expect(await ctx.dataSource.query(`SELECT id FROM inactivity_reasons`)).toEqual([]);
    await staff.agent.post(startPath(client.userId)).send({ reason: 'injury', recontactOn: today() }).expect(201);
  });

  it('answers CLIENT_NOT_FOUND for unknown users and staff accounts', async () => {
    const missing = '11111111-1111-4111-8111-111111111111';
    for (const id of [missing, staff.userId]) {
      await staff.agent.post(startPath(id)).send({ reason: 'injury' }).expect(404).expect(expectCode('CLIENT_NOT_FOUND'));
      await staff.agent.post(endPath(id)).expect(404).expect(expectCode('CLIENT_NOT_FOUND'));
    }
    await staff.agent.post(startPath('nope')).send({ reason: 'injury' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('is staff only', async () => {
    const client = await signUpClient(ctx.app);
    await client.agent.post(startPath(client.userId)).send({ reason: 'injury' }).expect(403).expect(expectCode('FORBIDDEN'));
    await request(ctx.app.getHttpServer()).post(endPath(client.userId)).expect(401).expect(expectCode('UNAUTHENTICATED'));
  });
});
