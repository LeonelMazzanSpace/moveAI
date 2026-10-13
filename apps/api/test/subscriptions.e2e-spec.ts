import request from 'supertest';
import { addDays, addMonths, businessToday, diffDays } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { SubscriptionsService } from '../src/modules/subscriptions/services/subscriptions.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';

describe('subscriptions (e2e)', () => {
  let ctx: TestApp;
  let subs: SubscriptionsService;
  beforeAll(async () => { ctx = await createTestApp(); subs = ctx.app.get(SubscriptionsService); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

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

  // Barrier: a separate connection takes the lock first, `start` fires the competing work without awaiting it, and the
  // lock is only released once `waiters` backends are blocked on it, so the work really overlaps.
  async function whileLockHeld<T>(lock: { sql: string; params: unknown[] }, waiters: number, start: () => Promise<T>): Promise<T> {
    const gate = ctx.dataSource.createQueryRunner();
    await gate.connect();
    await gate.startTransaction();
    let pending: Promise<T> | undefined;
    try {
      await gate.query(lock.sql, lock.params);
      pending = start();
      await waitForLockWaiters(waiters);
    } finally {
      await gate.commitTransaction();
      await gate.release();
      await pending?.then(() => undefined, () => undefined);
    }
    return pending;
  }
  const userLock = (userId: string) => ({ sql: `SELECT pg_advisory_xact_lock(hashtext('subscriptions:' || $1))`, params: [userId] });
  const subscriptionLock = (id: string) => ({ sql: `SELECT id FROM subscriptions WHERE id = $1 FOR UPDATE`, params: [id] });

  const planBySlug = async (slug: string) => {
    const [row] = await ctx.dataSource.query(
      `SELECT id, name, service, kind, period_months AS "periodMonths", period_days AS "periodDays", sessions_included AS "sessionsIncluded" FROM plans WHERE slug = $1`, [slug]);
    return row;
  };
  const purchase = async (userId: string, planId: string) => {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO purchases (user_id, kind, plan_id, amount, method, status) VALUES ($1, 'plan', $2, 100, 'cash', 'approved') RETURNING id`, [userId, planId]);
    return row.id as string;
  };

  it('activates idempotently and exposes /me/subscriptions', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('performance-trimestral');
    const purchaseId = await purchase(userId, plan.id);
    const today = businessToday();
    const a = await ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today }));
    const b = await ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today }));
    expect(b.id).toBe(a.id);
    const res = await agent.get('/api/me/subscriptions').expect(200);
    expect(res.body.performance).toMatchObject({ planName: 'Plan Trimestral', startsOn: today, status: 'active' });
    expect(res.body.recoveryPacks).toEqual([]);
  });

  it('never oversells a pack under concurrency', async () => {
    const { userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('recovery-paquete-4');
    const purchaseId = await purchase(userId, plan.id);
    const today = businessToday();
    const pack = await ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today }));
    await ctx.dataSource.query(`UPDATE subscriptions SET sessions_used = 3 WHERE id = $1`, [pack.id]);
    const date = addDays(today, 1);
    const results = await whileLockHeld(subscriptionLock(pack.id), 2, () => Promise.all([
      ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, date)),
      ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, date)),
    ]));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)).toMatchObject({ id: pack.id, sessionsUsed: 4 });
    await ctx.dataSource.transaction((m) => subs.releasePackSession(m, pack.id));
    const [row] = await ctx.dataSource.query(`SELECT sessions_used FROM subscriptions WHERE id = $1`, [pack.id]);
    expect(row.sessions_used).toBe(3);
  });

  it('gives the next pack to a consumer that waited for an exhausted one', async () => {
    const { userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const packA = await activate(userId, 'recovery-paquete-4', addDays(today, -10));
    const packB = await activate(userId, 'recovery-paquete-8', today);
    await ctx.dataSource.query(`UPDATE subscriptions SET sessions_used = 3 WHERE id = $1`, [packA.id]);
    const results = await whileLockHeld(subscriptionLock(packA.id), 2, () => Promise.all([
      ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, today)),
      ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, today)),
    ]));
    expect(results.every(Boolean)).toBe(true);
    expect(results.map((pack) => pack?.id).sort((x, y) => String(x).localeCompare(String(y)))).toEqual([packA.id, packB.id].sort((x, y) => x.localeCompare(y)));
    expect(await subs.findById(packA.id)).toMatchObject({ sessionsUsed: 4 });
    expect(await subs.findById(packB.id)).toMatchObject({ sessionsUsed: 1 });
  });

  it('covers the last day of the period', async () => {
    const { userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('performance-mensual');
    await ctx.dataSource.query(
      `INSERT INTO subscriptions (user_id, plan_id, service, starts_on, ends_on) VALUES ($1, $2, 'performance', '2026-10-15', '2026-11-15')`, [userId, plan.id]);
    const yes = await ctx.dataSource.transaction((m) => subs.findCoveringPerformance(m, userId, '2026-11-15'));
    const no = await ctx.dataSource.transaction((m) => subs.findCoveringPerformance(m, userId, '2026-11-16'));
    expect(yes).not.toBeNull();
    expect(no).toBeNull();
  });

  const insertPerformance = async (userId: string, planId: string, startsOn: string, endsOn: string) => {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO subscriptions (user_id, plan_id, service, starts_on, ends_on) VALUES ($1, $2, 'performance', $3, $4) RETURNING id`,
      [userId, planId, startsOn, endsOn]);
    return row.id as string;
  };
  const activate = async (userId: string, slug: string, today = businessToday()) => {
    const plan = await planBySlug(slug);
    const purchaseId = await purchase(userId, plan.id);
    return ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today }));
  };

  it('stores a single row when the same purchase is activated twice, even concurrently', async () => {
    const { userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('performance-mensual');
    const purchaseId = await purchase(userId, plan.id);
    const today = businessToday();
    const [a, b] = await whileLockHeld(userLock(userId), 2, () => Promise.all([
      ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today })),
      ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today })),
    ]));
    expect(b.id).toBe(a.id);
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM subscriptions WHERE purchase_id = $1`, [purchaseId]);
    expect(count).toBe(1);
  });

  it('extends an early renewal from the current end without losing days', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const currentEnd = addDays(today, 5);
    const plan = await planBySlug('performance-mensual');
    await insertPerformance(userId, plan.id, addDays(today, -20), currentEnd);
    const renewal = await activate(userId, 'performance-mensual', today);
    expect(renewal).toMatchObject({ service: 'performance', startsOn: addDays(currentEnd, 1), endsOn: addMonths(currentEnd, 1), sessionsTotal: null, planName: 'Plan Mensual' });
    const res = await agent.get('/api/me/subscriptions').expect(200);
    expect(res.body.performance).toMatchObject({ endsOn: currentEnd, status: 'expiring', daysLeft: 5 });
    expect(res.body.upcomingPerformance).toMatchObject({ id: renewal.id, startsOn: addDays(currentEnd, 1), status: 'scheduled', progressPct: 0 });
  });

  it('marks a plan as expiring only within expiring_soon_days', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const plan = await planBySlug('performance-mensual');
    await insertPerformance(userId, plan.id, addDays(today, -20), addDays(today, 5));
    await ctx.dataSource.query(`UPDATE settings SET value = '3'::jsonb WHERE key = 'expiring_soon_days'`);
    const outside = await agent.get('/api/me/subscriptions').expect(200);
    expect(outside.body.performance).toMatchObject({ status: 'active', daysLeft: 5 });
    await ctx.dataSource.query(`UPDATE settings SET value = '5'::jsonb WHERE key = 'expiring_soon_days'`);
    const boundary = await agent.get('/api/me/subscriptions').expect(200);
    expect(boundary.body.performance).toMatchObject({ status: 'expiring', daysLeft: 5 });
  });

  it('chains consecutive renewals from the latest end', async () => {
    const { userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const first = await activate(userId, 'performance-mensual', today);
    const second = await activate(userId, 'performance-trimestral', today);
    expect(second.startsOn).toBe(addDays(first.endsOn, 1));
    expect(second.endsOn).toBe(addMonths(first.endsOn, 3));
  });

  it('restarts today when the previous plan already expired', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const plan = await planBySlug('performance-mensual');
    await insertPerformance(userId, plan.id, addDays(today, -40), addDays(today, -3));
    const before = await agent.get('/api/me/subscriptions').expect(200);
    expect(before.body).toMatchObject({ performance: { status: 'expired', daysLeft: 0, progressPct: 100 }, upcomingPerformance: null });
    const renewal = await activate(userId, 'performance-mensual', today);
    expect(renewal).toMatchObject({ startsOn: today, endsOn: addMonths(today, 1) });
    const after = await agent.get('/api/me/subscriptions').expect(200);
    expect(after.body.performance).toMatchObject({ id: renewal.id, status: 'active', daysLeft: diffDays(today, addMonths(today, 1)), progressPct: 0 });
  });

  it('serializes the first two purchases of a user so periods never overlap', async () => {
    const { userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('performance-mensual');
    const [p1, p2] = [await purchase(userId, plan.id), await purchase(userId, plan.id)];
    const today = businessToday();
    const created = await whileLockHeld(userLock(userId), 2, () => Promise.all([p1, p2].map((purchaseId) =>
      ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today })))));
    const [early, late] = [...created].sort((x, y) => x.startsOn.localeCompare(y.startsOn));
    expect(early.startsOn).toBe(today);
    expect(late.startsOn).toBe(addDays(early.endsOn, 1));
  });

  it('activates a 30-day pack with its balance and lists it', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const pack = await activate(userId, 'recovery-paquete-4', today);
    expect(pack).toMatchObject({ service: 'recovery', startsOn: today, endsOn: addDays(today, 29), sessionsTotal: 4, sessionsUsed: 0 });
    const res = await agent.get('/api/me/subscriptions').expect(200);
    expect(res.body).toEqual({
      performance: null,
      upcomingPerformance: null,
      recoveryPacks: [{ id: pack.id, planId: pack.planId, planName: 'Paquete 4 sesiones', startsOn: today, endsOn: addDays(today, 29), sessionsTotal: 4, sessionsUsed: 0, sessionsLeft: 4 }],
    });
  });

  it('rejects plans that do not create subscriptions', async () => {
    const { userId } = await signUpClient(ctx.app);
    const plan = await planBySlug('rehab-evaluacion');
    const purchaseId = await purchase(userId, plan.id);
    await expect(ctx.dataSource.transaction((m) => subs.activateFromPurchase(m, { purchaseId, userId, plan, today: businessToday() })))
      .rejects.toMatchObject({ code: 'PLAN_KIND_INVALID' });
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM subscriptions`);
    expect(count).toBe(0);
  });

  it('consumes from the pack that ends first, returns null without balance and gives the session back', async () => {
    const { userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const older = await activate(userId, 'recovery-paquete-4', addDays(today, -10));
    const newer = await activate(userId, 'recovery-paquete-8', today);
    await ctx.dataSource.query(`UPDATE subscriptions SET sessions_used = 3 WHERE id = $1`, [older.id]);
    const first = await ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, today));
    expect(first).toMatchObject({ id: older.id, sessionsUsed: 4 });
    const second = await ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, today));
    expect(second).toMatchObject({ id: newer.id, sessionsUsed: 1 });
    await ctx.dataSource.query(`UPDATE subscriptions SET sessions_used = 8 WHERE id = $1`, [newer.id]);
    expect(await ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, today))).toBeNull();
    expect(await ctx.dataSource.transaction((m) => subs.consumePackSession(m, userId, addDays(today, 30)))).toBeNull();
    await ctx.dataSource.transaction((m) => subs.releasePackSession(m, older.id));
    expect(await subs.findById(older.id)).toMatchObject({ sessionsUsed: 3 });
  });

  it('ignores soft-deleted subscriptions', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const today = businessToday();
    const plan = await planBySlug('performance-mensual');
    const id = await insertPerformance(userId, plan.id, today, addMonths(today, 1));
    await ctx.dataSource.query(`UPDATE subscriptions SET deleted_at = now() WHERE id = $1`, [id]);
    expect(await ctx.dataSource.transaction((m) => subs.findCoveringPerformance(m, userId, today))).toBeNull();
    expect(await subs.findById(id)).toBeNull();
    expect(await subs.listPerformanceByUsers([userId])).toEqual([]);
    expect((await agent.get('/api/me/subscriptions').expect(200)).body.performance).toBeNull();
  });

  it('lists Performance subscriptions and active packs by users', async () => {
    const a = await signUpClient(ctx.app);
    const b = await signUpClient(ctx.app);
    const today = businessToday();
    const perf = await activate(a.userId, 'performance-mensual', today);
    const pack = await activate(b.userId, 'recovery-paquete-4', today);
    await activate(b.userId, 'recovery-paquete-4', addDays(today, -40));
    expect((await subs.listPerformanceByUsers([a.userId, b.userId])).map((s) => s.id)).toEqual([perf.id]);
    expect((await subs.listActivePacksByUsers([a.userId, b.userId], today)).map((s) => s.id)).toEqual([pack.id]);
    expect(await subs.listPerformanceByUsers([])).toEqual([]);
    expect(await subs.listActivePacksByUsers([], today)).toEqual([]);
  });

  it('requires a client session', async () => {
    const anonymous = await request(ctx.app.getHttpServer()).get('/api/me/subscriptions').expect(401);
    expect(anonymous.body.code).toBe('UNAUTHENTICATED');
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const staff = await agent.get('/api/me/subscriptions').expect(403);
    expect(staff.body.code).toBe('FORBIDDEN');
  });
});
