import request from 'supertest';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';

const DEFAULTS = {
  cancelLimitHours: 2, bookingWindowDays: 14, pendingPaymentMinutes: 15, reconcileAfterMinutes: 10, expiringSoonDays: 7,
  noAttendanceDays: 7, prolongedInactivityDays: 21, frequencyDropRatio: 0.5, frequencyRecentWeeks: 2,
  frequencyBaselineWeeks: 8, checkinMonthlyEnabled: true, valuesProvisional: true,
};

describe('settings (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });

  const http = () => request(ctx.app.getHttpServer());

  it('exposes only the public settings without a session', async () => {
    const res = await http().get('/api/settings/public').expect(200);
    expect(res.body).toEqual({ cancelLimitHours: 2, bookingWindowDays: 14 });
  });

  it('lets staff read every setting', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.get('/api/staff/settings').expect(200);
    expect(res.body).toEqual(DEFAULTS);
  });

  it('updates one setting, keeps the rest, and records updated_by', async () => {
    const { agent, userId } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.patch('/api/staff/settings').send({ cancelLimitHours: 3 }).expect(200);
    expect(res.body).toEqual({ ...DEFAULTS, cancelLimitHours: 3 });
    expect((await agent.get('/api/staff/settings').expect(200)).body).toEqual({ ...DEFAULTS, cancelLimitHours: 3 });
    const rows = await ctx.dataSource.query(`SELECT key, updated_by FROM settings WHERE updated_by IS NOT NULL`);
    expect(rows).toEqual([{ key: 'cancel_limit_hours', updated_by: userId }]);
    expect((await http().get('/api/settings/public').expect(200)).body.cancelLimitHours).toBe(3);
  });

  it('updates several settings at once, including booleans and the ratio', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const patch = { bookingWindowDays: 30, frequencyDropRatio: 0.3, checkinMonthlyEnabled: false, valuesProvisional: false, noAttendanceDays: 10, prolongedInactivityDays: 30 };
    const res = await agent.patch('/api/staff/settings').send(patch).expect(200);
    expect(res.body).toEqual({ ...DEFAULTS, ...patch });
  });

  it('accepts an empty patch and changes nothing', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    expect((await agent.patch('/api/staff/settings').send({}).expect(200)).body).toEqual(DEFAULTS);
  });

  it('rejects inconsistent thresholds with SETTINGS_INVALID and persists nothing', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    await agent.patch('/api/staff/settings').send({ prolongedInactivityDays: 7 }).expect(400)
      .expect((r) => expect(r.body.code).toBe('SETTINGS_INVALID'));
    await agent.patch('/api/staff/settings').send({ prolongedInactivityDays: 5 }).expect(400)
      .expect((r) => expect(r.body.code).toBe('VALIDATION_FAILED'));
    await agent.patch('/api/staff/settings').send({ prolongedInactivityDays: 10, noAttendanceDays: 12, cancelLimitHours: 5 }).expect(400)
      .expect((r) => expect(r.body.code).toBe('SETTINGS_INVALID'));
    await agent.patch('/api/staff/settings').send({ noAttendanceDays: 30 }).expect(400)
      .expect((r) => expect(r.body.code).toBe('SETTINGS_INVALID'));
    expect((await agent.get('/api/staff/settings').expect(200)).body).toEqual(DEFAULTS);
  });

  it('rejects values out of range with VALIDATION_FAILED', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    await agent.patch('/api/staff/settings').send({ cancelLimitHours: 999 }).expect(400)
      .expect((r) => expect(r.body.code).toBe('VALIDATION_FAILED'));
    expect((await agent.get('/api/staff/settings').expect(200)).body).toEqual(DEFAULTS);
  });

  it.each([
    ['cancelLimitHours -1', { cancelLimitHours: -1 }],
    ['cancelLimitHours 73', { cancelLimitHours: 73 }],
    ['cancelLimitHours 1e20', { cancelLimitHours: 1e20 }],
    ['cancelLimitHours fractional', { cancelLimitHours: 1.5 }],
    ['cancelLimitHours string', { cancelLimitHours: '3' }],
    ['cancelLimitHours null', { cancelLimitHours: null }],
    ['bookingWindowDays 0', { bookingWindowDays: 0 }],
    ['bookingWindowDays 61', { bookingWindowDays: 61 }],
    ['pendingPaymentMinutes 4', { pendingPaymentMinutes: 4 }],
    ['pendingPaymentMinutes 121', { pendingPaymentMinutes: 121 }],
    ['reconcileAfterMinutes 4', { reconcileAfterMinutes: 4 }],
    ['reconcileAfterMinutes 1441', { reconcileAfterMinutes: 1441 }],
    ['expiringSoonDays 0', { expiringSoonDays: 0 }],
    ['expiringSoonDays 31', { expiringSoonDays: 31 }],
    ['noAttendanceDays 2', { noAttendanceDays: 2 }],
    ['noAttendanceDays 61', { noAttendanceDays: 61 }],
    ['prolongedInactivityDays 6', { prolongedInactivityDays: 6 }],
    ['prolongedInactivityDays 181', { prolongedInactivityDays: 181 }],
    ['frequencyDropRatio 0.05', { frequencyDropRatio: 0.05 }],
    ['frequencyDropRatio 0.95', { frequencyDropRatio: 0.95 }],
    ['frequencyDropRatio string', { frequencyDropRatio: '0.5' }],
    ['frequencyDropRatio null', { frequencyDropRatio: null }],
    ['frequencyRecentWeeks 0', { frequencyRecentWeeks: 0 }],
    ['frequencyRecentWeeks 9', { frequencyRecentWeeks: 9 }],
    ['frequencyBaselineWeeks 1', { frequencyBaselineWeeks: 1 }],
    ['frequencyBaselineWeeks 27', { frequencyBaselineWeeks: 27 }],
    ['checkinMonthlyEnabled string', { checkinMonthlyEnabled: 'true' }],
    ['checkinMonthlyEnabled null', { checkinMonthlyEnabled: null }],
    ['valuesProvisional null', { valuesProvisional: null }],
    ['unknown key', { somethingElse: 1 }],
  ])('rejects %s', async (_label, body) => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    await agent.patch('/api/staff/settings').send(body).expect(400)
      .expect((r) => expect(r.body.code).toBe('VALIDATION_FAILED'));
    expect((await agent.get('/api/staff/settings').expect(200)).body).toEqual(DEFAULTS);
  });

  it('accepts the range boundaries', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const patch = {
      cancelLimitHours: 72, bookingWindowDays: 60, pendingPaymentMinutes: 120, reconcileAfterMinutes: 1440, expiringSoonDays: 30,
      noAttendanceDays: 60, prolongedInactivityDays: 180, frequencyDropRatio: 0.9, frequencyRecentWeeks: 8, frequencyBaselineWeeks: 26,
    };
    expect((await agent.patch('/api/staff/settings').send(patch).expect(200)).body).toMatchObject(patch);
    const low = { cancelLimitHours: 0, bookingWindowDays: 1, pendingPaymentMinutes: 5, reconcileAfterMinutes: 5, expiringSoonDays: 1, noAttendanceDays: 3, prolongedInactivityDays: 7, frequencyDropRatio: 0.1, frequencyRecentWeeks: 1, frequencyBaselineWeeks: 2 };
    expect((await agent.patch('/api/staff/settings').send(low).expect(200)).body).toMatchObject(low);
  });

  it('keeps staff settings away from clients and anonymous users', async () => {
    const client = await signUpClient(ctx.app);
    await client.agent.get('/api/staff/settings').expect(403);
    await client.agent.patch('/api/staff/settings').send({ cancelLimitHours: 3 }).expect(403);
    await http().get('/api/staff/settings').expect(401);
    await http().patch('/api/staff/settings').send({ cancelLimitHours: 3 }).expect(401);
    const rows = await ctx.dataSource.query(`SELECT 1 FROM settings WHERE updated_by IS NOT NULL`);
    expect(rows).toHaveLength(0);
  });

  it('lets a signed-in client read the public settings', async () => {
    const client = await signUpClient(ctx.app);
    expect((await client.agent.get('/api/settings/public').expect(200)).body).toEqual({ cancelLimitHours: 2, bookingWindowDays: 14 });
  });
});
