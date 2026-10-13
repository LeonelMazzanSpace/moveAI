import type { NestExpressApplication } from '@nestjs/platform-express';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDays, businessToday } from '../src/common/time/business-time.js';
import { schedulerConfig } from '../src/config/scheduler.config.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { AutomationsService } from '../src/modules/automations/services/automations.service.js';
import { SettingsService } from '../src/modules/settings/services/settings.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { givePerformancePlan } from './utils/fixtures.js';

const today = () => businessToday();
const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
const emails = async (ds: DataSource, template: string) =>
  ds.query(`SELECT user_id AS "userId", idempotency_key AS key FROM email_logs WHERE template = $1`, [template]);

describe('automations — staff endpoint (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const planFor = async (input: { startsOn: string; endsOn: string }) => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, input);
    return client;
  };
  const expiringIn5Days = () => planFor({ startsOn: addDays(today(), -3), endsOn: addDays(today(), 5) });

  it('sends each expiry reminder once and skips paused clients', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const active = await expiringIn5Days();
    const paused = await expiringIn5Days();
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'vacation' }).expect(201);

    const first = await staff.agent.post('/api/staff/automations/run/expiry-reminders').expect(200);
    expect(first.body).toEqual({ job: 'expiry-reminders', ran: true, result: { expiring: 1, expired: 0 } });
    const second = await staff.agent.post('/api/staff/automations/run/expiry-reminders').expect(200);
    expect(second.body).toEqual({ job: 'expiry-reminders', ran: true, result: { expiring: 0, expired: 0 } });

    const [subscription] = await ctx.dataSource.query(`SELECT id FROM subscriptions WHERE user_id = $1`, [active.userId]);
    expect(await emails(ctx.dataSource, 'plan-expiring')).toEqual([{ userId: active.userId, key: `plan-expiring:${subscription.id}` }]);
    expect(await emails(ctx.dataSource, 'plan-expired')).toEqual([]);
  });

  it('sends plan-expired 1 to 3 days after the end, and neither reminder to renewed clients', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const expired = await planFor({ startsOn: addDays(today(), -32), endsOn: addDays(today(), -2) });
    const tooOld = await planFor({ startsOn: addDays(today(), -40), endsOn: addDays(today(), -4) });
    const renewed = await expiringIn5Days();
    await givePerformancePlan(ctx.dataSource, renewed.userId, { startsOn: addDays(today(), 6), endsOn: addDays(today(), 36) });
    const renewedAfterExpiry = await planFor({ startsOn: addDays(today(), -32), endsOn: addDays(today(), -1) });
    await givePerformancePlan(ctx.dataSource, renewedAfterExpiry.userId, { startsOn: addDays(today(), 0), endsOn: addDays(today(), 30) });

    const body = (await staff.agent.post('/api/staff/automations/run/expiry-reminders').expect(200)).body;
    expect(body.result).toEqual({ expiring: 0, expired: 1 });
    expect((await emails(ctx.dataSource, 'plan-expired')).map((r: { userId: string }) => r.userId)).toEqual([expired.userId]);
    expect(await emails(ctx.dataSource, 'plan-expiring')).toEqual([]);
    expect(tooOld.userId).not.toBe(expired.userId);
  });

  it('detects follow-up alerts without duplicating them and leaves paused clients out', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    await expiringIn5Days();
    const paused = await expiringIn5Days();
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);

    const first = await staff.agent.post('/api/staff/automations/run/followup-detect').expect(200);
    expect(first.body).toMatchObject({ job: 'followup-detect', ran: true, result: { expiring: 1 } });
    const second = await staff.agent.post('/api/staff/automations/run/followup-detect').expect(200);
    expect(second.body.result).toMatchObject({ expiring: 0, recontact: 0 });
    expect(await ctx.dataSource.query(`SELECT type FROM followup_alerts WHERE status = 'open'`)).toEqual([{ type: 'expiring' }]);
  });

  it('sends check-ins on demand to eligible clients only, once per month', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    await expiringIn5Days();
    const paused = await expiringIn5Days();
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);
    await signUpClient(ctx.app);

    const first = await staff.agent.post('/api/staff/automations/run/checkins-monthly').expect(200);
    expect(first.body).toEqual({ job: 'checkins-monthly', ran: true, result: { sent: 1 } });
    expect((await staff.agent.post('/api/staff/automations/run/checkins-monthly').expect(200)).body.result).toEqual({ sent: 0 });
    expect(await emails(ctx.dataSource, 'checkin-invite')).toHaveLength(1);
  });

  it.each(['generate-slots', 'expire-holds', 'reconcile-payments'])('runs %s even with SCHEDULER_ENABLED=false', async (job) => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await staff.agent.post(`/api/staff/automations/run/${job}`).expect(200);
    expect(res.body).toMatchObject({ job, ran: true });
    expect(Object.values(res.body.result).every((n) => typeof n === 'number')).toBe(true);
  });

  it('creates the slots of the booking window with generate-slots', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await staff.agent.post('/api/staff/automations/run/generate-slots').expect(200);
    expect(res.body.result.created).toBeGreaterThan(0);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM time_slots`);
    expect(count).toBe(res.body.result.created);
  });

  it('expires stale holds with expire-holds', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const [slot] = await ctx.dataSource.query(
      `INSERT INTO time_slots (service, starts_at, ends_at, capacity) VALUES ('recovery', now() + interval '2 days', now() + interval '2 days 45 minutes', 1) RETURNING id`,
    );
    await ctx.dataSource.query(
      `INSERT INTO bookings (user_id, time_slot_id, status, source, hold_expires_at) VALUES ($1, $2, 'pending_payment', 'payment', now() - interval '1 minute')`,
      [client.userId, slot.id],
    );
    const res = await staff.agent.post('/api/staff/automations/run/expire-holds').expect(200);
    expect(res.body.result).toEqual({ expired: 1 });
    expect(await ctx.dataSource.query(`SELECT status FROM bookings`)).toEqual([{ status: 'expired' }]);
  });

  it('answers JOB_UNKNOWN for other names', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    await staff.agent.post('/api/staff/automations/run/borrar-todo').expect(404).expect(expectCode('JOB_UNKNOWN'));
  });

  it('forbids clients (403) and anonymous callers (401)', async () => {
    const client = await signUp(ctx.app);
    await client.agent.post('/api/staff/automations/run/followup-detect').expect(403).expect(expectCode('FORBIDDEN'));
    await request(ctx.app.getHttpServer()).post('/api/staff/automations/run/followup-detect').expect(401).expect(expectCode('UNAUTHENTICATED'));
  });

  it('respects the job lock: a run that finds the job locked reports ran=false and does nothing', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    await expiringIn5Days();
    const holder = ctx.dataSource.createQueryRunner();
    await holder.connect();
    try {
      await holder.query(`SELECT pg_advisory_lock(hashtext('followup-detect'))`);
      const locked = await staff.agent.post('/api/staff/automations/run/followup-detect').expect(200);
      expect(locked.body).toEqual({ job: 'followup-detect', ran: false, result: {} });
      expect(await ctx.dataSource.query(`SELECT 1 FROM followup_alerts`)).toHaveLength(0);
    } finally {
      await holder.query(`SELECT pg_advisory_unlock(hashtext('followup-detect'))`);
      await holder.release();
    }
    const free = await staff.agent.post('/api/staff/automations/run/followup-detect').expect(200);
    expect(free.body).toMatchObject({ ran: true, result: { expiring: 1 } });
  });

  it('does not run scheduled (non-forced) jobs while SCHEDULER_ENABLED=false', async () => {
    await expiringIn5Days();
    const automations = ctx.app.get(AutomationsService);
    expect(await automations.run('followup-detect', { force: false })).toEqual({ job: 'followup-detect', ran: false, result: {} });
    expect(await automations.run('expiry-reminders', { force: false })).toEqual({ job: 'expiry-reminders', ran: false, result: {} });
    expect(await ctx.dataSource.query(`SELECT 1 FROM followup_alerts`)).toHaveLength(0);
    expect(await ctx.dataSource.query(`SELECT 1 FROM email_logs`)).toHaveLength(0);
  });
});

// The scheduler is enabled here so the non-forced path (what the crons call) can be exercised; real crons are stopped.
describe('automations — monthly check-ins schedule (e2e)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(schedulerConfig.KEY).useValue({ enabled: true })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    for (const job of app.get(SchedulerRegistry).getCronJobs().values()) await job.stop();
    ds = app.get(DataSource);
  });
  afterAll(async () => { vi.useRealTimers(); await app.close(); });
  beforeEach(async () => { await resetDb(ds); await seedCatalogAndSchedule(ds); });
  afterEach(() => { vi.useRealTimers(); });

  // 2026-11-02 is the first Monday of November 2026 (09:30 in Montevideo).
  const FIRST_MONDAY = new Date('2026-11-02T12:30:00Z');
  const SECOND_MONDAY = new Date('2026-11-09T12:30:00Z');
  const clientWithPlan = async () => {
    const client = await signUpClient(app);
    await givePerformancePlan(ds, client.userId, { startsOn: '2026-10-20', endsOn: '2026-12-20' });
    return client;
  };
  const runAt = async (now: Date) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    return app.get(AutomationsService).run('checkins-monthly', { force: false });
  };

  it('sends on the first Monday of the month, and only once', async () => {
    await clientWithPlan();
    expect(await runAt(FIRST_MONDAY)).toEqual({ job: 'checkins-monthly', ran: true, result: { sent: 1 } });
    expect(await runAt(FIRST_MONDAY)).toEqual({ job: 'checkins-monthly', ran: true, result: { sent: 0 } });
    expect(await ds.query(`SELECT period FROM checkins`)).toEqual([{ period: '2026-11' }]);
  });

  it('skips any other day', async () => {
    await clientWithPlan();
    expect(await runAt(SECOND_MONDAY)).toEqual({ job: 'checkins-monthly', ran: true, result: { skipped: 1 } });
    expect(await runAt(new Date('2026-11-03T12:30:00Z'))).toEqual({ job: 'checkins-monthly', ran: true, result: { skipped: 1 } });
    expect(await ds.query(`SELECT 1 FROM checkins`)).toHaveLength(0);
  });

  it('skips the first Monday when the monthly option is off, but a forced run still sends', async () => {
    const staff = await signUpStaff(app, ds);
    await clientWithPlan();
    await app.get(SettingsService).update({ checkinMonthlyEnabled: false }, staff.userId);
    expect(await runAt(FIRST_MONDAY)).toEqual({ job: 'checkins-monthly', ran: true, result: { skipped: 1 } });
    expect(await ds.query(`SELECT 1 FROM checkins`)).toHaveLength(0);
    const forced = await app.get(AutomationsService).run('checkins-monthly', { force: true });
    expect(forced.result).toEqual({ sent: 1 });
  });
});
