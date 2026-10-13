import { Logger } from '@nestjs/common';
import request from 'supertest';
import { addDays, businessMonth, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { CheckinsService } from '../src/modules/followup/services/checkins.service.js';
import type { UserModel } from '../src/modules/users/models/user.model.js';
import { UsersService } from '../src/modules/users/services/users.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb, waitForLockWaiters } from './utils/db.js';
import { givePerformancePlan } from './utils/fixtures.js';

describe('check-ins (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  it('sends once per month, answers with pain and refers to Rehab', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const noPlan = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: businessToday(), endsOn: addDays(businessToday(), 30) });

    const first = await staff.agent.post('/api/staff/checkins/send').expect(201);
    expect(first.body).toEqual({ sent: 1, period: businessMonth(businessToday()) });
    expect((await staff.agent.post('/api/staff/checkins/send').expect(201)).body.sent).toBe(0);
    expect((await noPlan.agent.get('/api/me/checkins/pending').expect(200)).body.checkin).toBeNull();

    const pending = (await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin;
    await client.agent.post(`/api/me/checkins/${pending.id}`).send({ feeling: 'good', pain: 'mild', goals: 'same' }).expect(400);
    const answered = await client.agent.post(`/api/me/checkins/${pending.id}`)
      .send({ feeling: 'good', pain: 'mild', painDetail: 'Molestia en hombro izquierdo al hacer press', goals: 'same' }).expect(200);
    expect(answered.body).toEqual({ flag: 'pain' });
    await client.agent.post(`/api/me/checkins/${pending.id}`).send({ feeling: 'good', pain: 'none', goals: 'same' })
      .expect(409).expect((r) => expect(r.body.code).toBe('CHECKIN_ALREADY_ANSWERED'));

    const stats = await staff.agent.get('/api/staff/checkins/stats').expect(200);
    expect(stats.body).toMatchObject({ sent: 1, answered: 1, needsIntervention: 1 });
    const referred = await staff.agent.post(`/api/staff/checkins/${pending.id}/refer-rehab`).expect(200);
    expect(referred.body.alertStatus).toBe('handled');
    expect((await client.agent.get('/api/me').expect(200)).body.rehabFollowupEnabled).toBe(true);
    const templates = (await ctx.dataSource.query(`SELECT template FROM email_logs ORDER BY created_at`)).map((r: { template: string }) => r.template);
    expect(templates).toEqual(['checkin-invite', 'rehab-referral']);
  });
});

describe('check-ins — rules (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const today = () => businessToday();
  const period = () => businessMonth(today());
  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
  const withPlan = async (name?: string) => {
    const client = await signUp(ctx.app, { name });
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -10), endsOn: addDays(today(), 30) });
    return client;
  };
  const sortByKey = <T extends { key: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.key.localeCompare(b.key));

  it('sends only to clients with a current Performance plan who are not paused', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const eligible = await withPlan('Martina Suárez');
    const paused = await withPlan();
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);
    const expired = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, expired.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), -1) });
    const future = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, future.userId, { startsOn: addDays(today(), 1), endsOn: addDays(today(), 30) });

    expect((await staff.agent.post('/api/staff/checkins/send').expect(201)).body).toEqual({ sent: 1, period: period() });
    const rows = await ctx.dataSource.query(`SELECT user_id AS "userId", period, status FROM checkins`);
    expect(rows).toEqual([{ userId: eligible.userId, period: period(), status: 'sent' }]);
    const logs = await ctx.dataSource.query(`SELECT template, user_id AS "userId", idempotency_key AS key FROM email_logs`);
    const [{ id }] = await ctx.dataSource.query(`SELECT id FROM checkins`);
    expect(logs).toEqual([{ template: 'checkin-invite', userId: eligible.userId, key: `checkin:${id}` }]);

    expect((await eligible.agent.get('/api/me/checkins/pending').expect(200)).body).toEqual({
      checkin: { id, period: period(), firstName: 'Martina' },
    });
    expect((await paused.agent.get('/api/me/checkins/pending').expect(200)).body.checkin).toBeNull();
  });

  // Barrier: an open transaction holds the (user_id, period) key, so both sends are seen waiting on it before it rolls back.
  it('keeps two concurrent sends to one check-in and one email', async () => {
    const client = await withPlan();
    const checkins = ctx.app.get(CheckinsService);
    const holder = ctx.dataSource.createQueryRunner();
    await holder.connect();
    await holder.startTransaction();
    let pending: Promise<{ sent: number }[]> | undefined;
    try {
      await holder.query(`INSERT INTO checkins (user_id, period) VALUES ($1, $2)`, [client.userId, period()]);
      pending = Promise.all([checkins.send(period()), checkins.send(period())]);
      await waitForLockWaiters(ctx.dataSource, 2);
    } catch (error) {
      await holder.rollbackTransaction();
      await holder.release();
      await Promise.allSettled([pending]);
      throw error;
    }
    await holder.rollbackTransaction();
    await holder.release();
    const results = (await pending) ?? [];
    expect(results.map((r) => r.sent).sort((a, b) => a - b)).toEqual([0, 1]);
    expect(await ctx.dataSource.query(`SELECT count(*)::int AS n FROM checkins`)).toEqual([{ n: 1 }]);
    expect(await ctx.dataSource.query(`SELECT count(*)::int AS n FROM email_logs`)).toEqual([{ n: 1 }]);
  });

  // A run that stopped between the insert and the emails left check-ins without an invite.
  it('emails the period check-ins that never got their invite, once', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const orphan = await withPlan();
    const paused = await withPlan();
    const lastMonth = await withPlan();
    const deleted = await withPlan();
    const insertCheckin = async (userId: string, p: string): Promise<string> =>
      (await ctx.dataSource.query(`INSERT INTO checkins (user_id, period) VALUES ($1, $2) RETURNING id`, [userId, p]))[0].id;
    const orphanId = await insertCheckin(orphan.userId, period());
    await insertCheckin(paused.userId, period());
    await insertCheckin(lastMonth.userId, '2020-01');
    await insertCheckin(deleted.userId, period());
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [deleted.userId]);
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);
    const invites = () => ctx.dataSource.query(`SELECT user_id AS "userId", idempotency_key AS key FROM email_logs ORDER BY created_at`);

    // `sent` counts new rows only: `lastMonth` gets this period's check-in; `orphan` gets the invite it never had.
    expect((await staff.agent.post('/api/staff/checkins/send').expect(201)).body).toEqual({ sent: 1, period: period() });
    const [{ id: newId }] = await ctx.dataSource.query(`SELECT id FROM checkins WHERE user_id = $1 AND period = $2`, [lastMonth.userId, period()]);
    const expected = [{ userId: orphan.userId, key: `checkin:${orphanId}` }, { userId: lastMonth.userId, key: `checkin:${newId}` }];
    expect(sortByKey(await invites())).toEqual(sortByKey(expected));
    // The client who was deleted gets no invite, so no email_logs row either.
    expect(await ctx.dataSource.query(`SELECT id FROM email_logs WHERE user_id = $1`, [deleted.userId])).toEqual([]);

    expect((await staff.agent.post('/api/staff/checkins/send').expect(201)).body.sent).toBe(0);
    expect(sortByKey(await invites())).toEqual(sortByKey(expected));
    expect(await ctx.dataSource.query(`SELECT id FROM email_logs WHERE user_id = $1`, [deleted.userId])).toEqual([]);
  });

  // The user lookup already drops deleted users; stubbing it to return everyone leaves the SQL filter of
  // `emailMissingInvites` (`u.deleted_at IS NULL`) as the only thing keeping a deleted client from being emailed.
  it('does not select the check-in of a deleted client for an invite, whatever the user lookup returns', async () => {
    const orphan = await withPlan();
    const deleted = await withPlan();
    for (const { userId } of [orphan, deleted]) {
      await ctx.dataSource.query(`INSERT INTO checkins (user_id, period) VALUES ($1, $2)`, [userId, period()]);
    }
    await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [deleted.userId]);
    const everyone = async (ids: string[]): Promise<UserModel[]> => ids.map((id) => ({
      id, name: 'Test', email: `${id}@test.move`, role: 'client', phone: null, rehabFollowupEnabled: false, createdAt: new Date(),
    }));
    const lookup = vi.spyOn(UsersService.prototype, 'findByIds').mockImplementation(everyone);
    try {
      await ctx.app.get(CheckinsService).send(period());
      expect(lookup).toHaveBeenCalled();
    } finally {
      lookup.mockRestore();
    }
    const emailed = await ctx.dataSource.query(`SELECT user_id AS "userId" FROM email_logs`);
    expect(emailed).toEqual([{ userId: orphan.userId }]);
  });

  it('lets only the owner answer and validates the answers', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await withPlan();
    const other = await withPlan();
    await staff.agent.post('/api/staff/checkins/send').expect(201);
    const { id } = (await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin;

    const ok = { feeling: 'very_good', pain: 'none', goals: 'same' };
    await other.agent.post(`/api/me/checkins/${id}`).send(ok).expect(404).expect(expectCode('CHECKIN_NOT_FOUND'));
    await client.agent.post('/api/me/checkins/11111111-1111-4111-8111-111111111111').send(ok).expect(404).expect(expectCode('CHECKIN_NOT_FOUND'));
    await staff.agent.post(`/api/me/checkins/${id}`).send(ok).expect(403).expect(expectCode('FORBIDDEN'));
    for (const body of [
      {}, { ...ok, feeling: 'meh' }, { ...ok, pain: 'severe' }, { ...ok, goals: 'other' }, { ...ok, pain: 'mild', painDetail: '   ' },
      { ...ok, pain: 'mild', painDetail: 'x'.repeat(501) }, { ...ok, goalsDetail: 'x'.repeat(501) }, { ...ok, painDetail: null },
      { ...ok, goalsDetail: 'a\u0000b' }, { ...ok, extra: 1 },
    ]) {
      await client.agent.post(`/api/me/checkins/${id}`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }

    await client.agent.post(`/api/me/checkins/${id}`).send({ ...ok, goals: 'adjust', goalsDetail: '  Quiero bajar de peso  ' }).expect(200)
      .expect((r) => expect(r.body).toEqual({ flag: 'goals' }));
    const [row] = await ctx.dataSource.query(`SELECT status, flag, goals_detail AS "goalsDetail", pain_detail AS "painDetail" FROM checkins WHERE id = $1`, [id]);
    expect(row).toEqual({ status: 'answered', flag: 'goals', goalsDetail: 'Quiero bajar de peso', painDetail: null });
    const alerts = await ctx.dataSource.query(`SELECT type, period_key AS "periodKey", context FROM followup_alerts`);
    expect(alerts).toEqual([{ type: 'checkin_goals', periodKey: `checkin:${id}`, context: { checkinId: id } }]);
    expect((await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin).toBeNull();
  });

  it('creates both check-in alerts when there is pain and a goals change, and lists responses', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const pained = await withPlan('Martina Suárez');
    const fine = await withPlan();
    await staff.agent.post('/api/staff/checkins/send').expect(201);
    const answer = async (agent: typeof pained.agent, body: Record<string, string>) => {
      const { id } = (await agent.get('/api/me/checkins/pending').expect(200)).body.checkin;
      await agent.post(`/api/me/checkins/${id}`).send(body).expect(200);
      return id as string;
    };
    const painId = await answer(pained.agent, { feeling: 'struggling', pain: 'mild', painDetail: 'Rodilla', goals: 'adjust', goalsDetail: 'Correr' });
    await answer(fine.agent, { feeling: 'good', pain: 'none', goals: 'same' });

    const alerts = await ctx.dataSource.query(`SELECT type FROM followup_alerts ORDER BY type`);
    expect(alerts).toEqual([{ type: 'checkin_goals' }, { type: 'checkin_pain' }]);
    const [painAlert] = (await staff.agent.get('/api/staff/alerts?type=checkin_pain').expect(200)).body;
    expect(painAlert.checkin).toEqual({ id: painId, painDetail: 'Rodilla', goalsDetail: 'Correr' });

    const responses = (await staff.agent.get('/api/staff/checkins/responses').expect(200)).body;
    expect(responses).toHaveLength(2);
    const flagged = (await staff.agent.get('/api/staff/checkins/responses?flag=pain').expect(200)).body;
    expect(flagged).toEqual([{
      id: painId, client: { id: pained.userId, name: 'Martina Suárez' }, period: period(), feeling: 'struggling', pain: 'mild',
      painDetail: 'Rodilla', goals: 'adjust', goalsDetail: 'Correr', flag: 'pain', respondedAt: expect.any(String),
      frequencyPerWeek: 0, planName: 'Plan Mensual', alertId: painAlert.id, alertStatus: 'open',
    }]);
    expect((await staff.agent.get(`/api/staff/checkins/responses?period=2020-01`).expect(200)).body).toEqual([]);
    expect((await staff.agent.get(`/api/staff/checkins/stats?period=${period()}`).expect(200)).body)
      .toEqual({ period: period(), sent: 2, answered: 2, needsIntervention: 1 });

    // Referring handles the pain alert only. Stats follow the flag's alert, like `alertStatus`: the goals alert stays open
    // in the alerts list, but the check-in no longer needs intervention.
    await staff.agent.post(`/api/staff/checkins/${painId}/refer-rehab`).expect(200)
      .expect((r) => expect(r.body).toMatchObject({ alertId: painAlert.id, alertStatus: 'handled' }));
    const statuses = await ctx.dataSource.query(`SELECT type, status FROM followup_alerts ORDER BY type`);
    expect(statuses).toEqual([{ type: 'checkin_goals', status: 'open' }, { type: 'checkin_pain', status: 'handled' }]);
    expect((await staff.agent.get('/api/staff/checkins/stats').expect(200)).body.needsIntervention).toBe(0);
    const listed = (await staff.agent.get('/api/staff/checkins/responses?flag=pain').expect(200)).body;
    expect(listed.map((r: { alertStatus: string }) => r.alertStatus)).toEqual(['handled']);
  });

  it('counts a goals check-in in needsIntervention while its own alert is open, like alertStatus', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await withPlan();
    await staff.agent.post('/api/staff/checkins/send').expect(201);
    const { id } = (await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin;
    await client.agent.post(`/api/me/checkins/${id}`).send({ feeling: 'good', pain: 'none', goals: 'adjust', goalsDetail: 'Fuerza' }).expect(200);
    const statusesNow = async () => ({
      needsIntervention: (await staff.agent.get('/api/staff/checkins/stats').expect(200)).body.needsIntervention,
      alertStatus: (await staff.agent.get('/api/staff/checkins/responses').expect(200)).body[0].alertStatus,
    });

    expect(await statusesNow()).toEqual({ needsIntervention: 1, alertStatus: 'open' });
    const [alert] = (await staff.agent.get('/api/staff/alerts?type=checkin_goals').expect(200)).body;
    await staff.agent.post(`/api/staff/alerts/${alert.id}/handle`).expect(200);
    expect(await statusesNow()).toEqual({ needsIntervention: 0, alertStatus: 'handled' });
  });

  it('validates staff queries and refer-rehab targets', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await withPlan();
    await staff.agent.post('/api/staff/checkins/send').expect(201);
    const { id } = (await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin;

    await staff.agent.post(`/api/staff/checkins/${id}/refer-rehab`).expect(404).expect(expectCode('CHECKIN_NOT_FOUND'));
    await staff.agent.post('/api/staff/checkins/11111111-1111-4111-8111-111111111111/refer-rehab').expect(404).expect(expectCode('CHECKIN_NOT_FOUND'));
    for (const query of ['period=2026-13', 'period=26-10', 'flag=bad', 'page=2']) {
      await staff.agent.get(`/api/staff/checkins/responses?${query}`).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
    await staff.agent.get('/api/staff/checkins/stats?period=oct').expect(400).expect(expectCode('VALIDATION_FAILED'));
    expect((await staff.agent.get('/api/staff/checkins/stats?period=2020-01').expect(200)).body)
      .toEqual({ period: '2020-01', sent: 0, answered: 0, needsIntervention: 0 });

    for (const path of ['/api/staff/checkins/stats', '/api/staff/checkins/responses']) {
      await client.agent.get(path).expect(403).expect(expectCode('FORBIDDEN'));
    }
    await client.agent.post('/api/staff/checkins/send').expect(403);
    await request(ctx.app.getHttpServer()).get('/api/me/checkins/pending').expect(401);
  });

  it('never logs check-in answers', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await withPlan();
    // Every service logs through a `Logger` instance (the testing logger drops `log`/`warn` before stdout).
    const spies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((level) => vi.spyOn(Logger.prototype, level));
    let logged = '';
    try {
      await staff.agent.post('/api/staff/checkins/send').expect(201);
      const { id } = (await client.agent.get('/api/me/checkins/pending').expect(200)).body.checkin;
      await client.agent.post(`/api/me/checkins/${id}`)
        .send({ feeling: 'struggling', pain: 'mild', painDetail: 'SECRET-PAIN-DETAIL', goals: 'adjust', goalsDetail: 'SECRET-GOALS' }).expect(200);
      await staff.agent.post(`/api/staff/checkins/${id}/refer-rehab`).expect(200);
      // Read before restoring: `mockRestore` also clears the recorded calls.
      logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
    // The capture works (dry-run emails log their template), and no answer leaks.
    expect(logged).toContain('rehab-referral');
    expect(logged).not.toMatch(/SECRET-|struggling/);
  });
});
