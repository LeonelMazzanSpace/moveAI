import request from 'supertest';
import { addDays, addMonths, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb, waitForLockWaiters } from './utils/db.js';
import { givePerformancePlan, planIdBySlug } from './utils/fixtures.js';

type SimAction = 'authorize' | 'charge_approved' | 'charge_rejected' | 'cancel';

// Development simulator active: no MP_ACCESS_TOKEN in the e2e environment (D4, D59).
describe('automatic debit (e2e, simulator)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp({ raiseCheckoutLimit: true }); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const http = () => request(ctx.app.getHttpServer());
  const expectCode = (code: string) => (r: request.Response) => expect(r.body.code).toBe(code);
  const today = () => businessToday();

  const startDebit = async (agent: TestAgent, planSlug = 'performance-mensual') =>
    (await agent.post('/api/checkout/auto-debit').send({ planSlug }).expect(201)).body as { externalReference: string; initPoint: string };
  const simulate = (externalReference: string, action: SimAction) =>
    http().post('/api/payments/dev/simulate-auto-debit').send({ externalReference, action }).expect(200);
  const count = async (sql: string, params: unknown[] = []): Promise<number> =>
    (await ctx.dataSource.query(`SELECT count(*)::int AS count FROM ${sql}`, params))[0].count as number;
  const debitRow = async (ref: string) =>
    (await ctx.dataSource.query(
      `SELECT id, status, cancel_reason AS "cancelReason", next_charge_date AS "nextChargeDate" FROM auto_debits WHERE external_reference = $1`,
      [ref],
    ))[0] as { id: string; status: string; cancelReason: string | null; nextChargeDate: string | null };

  describe('checkout', () => {
    it('creates a pending debit with the simulated init point and reports its status to its owner', async () => {
      const { agent } = await signUpClient(ctx.app);
      const res = await startDebit(agent);
      expect(res.initPoint).toBe(`${process.env.WEB_URL}/checkout/simulado?debito=${res.externalReference}`);
      const status = await agent.get(`/api/checkout/auto-debits/${res.externalReference}`).expect(200);
      expect(status.body).toEqual({
        externalReference: res.externalReference, status: 'pending', planName: 'Plan Mensual', planSlug: 'performance-mensual',
        service: 'performance', amount: 3900, nextChargeDate: null,
      });
      expect(await count('purchases')).toBe(0);
    });

    it('rejects plans without automatic debit and unknown or inactive plans', async () => {
      const { agent } = await signUpClient(ctx.app);
      for (const planSlug of ['performance-trimestral', 'recovery-sesion', 'rehab-evaluacion']) {
        await agent.post('/api/checkout/auto-debit').send({ planSlug }).expect(409).expect(expectCode('AUTO_DEBIT_NOT_ALLOWED'));
      }
      await agent.post('/api/checkout/auto-debit').send({ planSlug: 'nope' }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
      await ctx.dataSource.query(`UPDATE plans SET active = false WHERE slug = 'recovery-paquete-8'`);
      await agent.post('/api/checkout/auto-debit').send({ planSlug: 'recovery-paquete-8' }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
      expect(await count('auto_debits')).toBe(0);
    });

    it.each([
      ['missing slug', {}],
      ['blank slug', { planSlug: '   ' }],
      ['NUL in slug', { planSlug: 'performance\u0000mensual' }],
      ['slug over 80 chars', { planSlug: 'a'.repeat(81) }],
      ['non string slug', { planSlug: 1 }],
      ['unknown field', { planSlug: 'performance-mensual', amount: 1 }],
    ])('rejects %s', async (_label, body) => {
      const { agent } = await signUpClient(ctx.app);
      await agent.post('/api/checkout/auto-debit').send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('requires a client session', async () => {
      await http().post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(401).expect(expectCode('UNAUTHENTICATED'));
      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      await staff.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(403).expect(expectCode('FORBIDDEN'));
      await http().get('/api/me/auto-debits').expect(401);
    });

    it('cancels the previous pending debit of the same service and keeps the other service apart', async () => {
      const { agent } = await signUpClient(ctx.app);
      const first = await startDebit(agent);
      const pack = await startDebit(agent, 'recovery-paquete-4');
      const second = await startDebit(agent);
      expect(await debitRow(first.externalReference)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(await debitRow(second.externalReference)).toMatchObject({ status: 'pending', cancelReason: null });
      expect(await debitRow(pack.externalReference)).toMatchObject({ status: 'pending' });
      expect(await count(`auto_debits WHERE status IN ('pending','authorized')`)).toBe(2);
      expect(await count(`email_logs WHERE template = 'auto-debit-cancelled'`)).toBe(0);
    });

    it('answers AUTO_DEBIT_ACTIVE while the service already has an authorized debit', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await simulate(debit.externalReference, 'authorize');
      await agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(409).expect(expectCode('AUTO_DEBIT_ACTIVE'));
      expect(await debitRow(debit.externalReference)).toMatchObject({ status: 'authorized' });
      await startDebit(agent, 'recovery-paquete-4');
    });

    // Barrier: a separate transaction holds the per-client lock of the service, so both checkouts are in flight
    // before either reads the active debits. Without the lock the second insert hits the partial unique index.
    it('never leaves two active debits of the same service when two checkouts race', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const gate = ctx.dataSource.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      let pending: Promise<request.Response[]> | undefined;
      try {
        await gate.query(`SELECT pg_advisory_xact_lock(hashtext('auto-debits:' || $1 || ':performance'))`, [userId]);
        pending = Promise.all([
          agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }),
          agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }),
        ]);
        await waitForLockWaiters(ctx.dataSource, 2);
      } finally {
        await gate.commitTransaction();
        await gate.release();
      }
      const results = (await pending) ?? [];
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(await count(`auto_debits WHERE status IN ('pending','authorized')`)).toBe(1);
      expect(await count(`auto_debits WHERE status = 'cancelled' AND cancel_reason = 'client'`)).toBe(1);
    });

    it('waits for the end of a current Performance period before the first charge', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const endsOn = addDays(today(), 10);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: addDays(today(), -20), endsOn });
      const debit = await startDebit(agent);
      const pending = await agent.get(`/api/checkout/auto-debits/${debit.externalReference}`).expect(200);
      expect(pending.body.nextChargeDate).toBe(addDays(endsOn, 1));

      const authorized = await simulate(debit.externalReference, 'authorize');
      expect(authorized.body).toMatchObject({ status: 'authorized', nextChargeDate: addDays(endsOn, 1) });
      expect(await count('purchases')).toBe(0);

      await simulate(debit.externalReference, 'charge_approved');
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.upcomingPerformance).toMatchObject({ startsOn: addDays(endsOn, 1), endsOn: addMonths(endsOn, 1) });
    });

    it('starts a Recovery pack debit right away even with a current Performance period', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: today(), endsOn: addDays(today(), 10) });
      const debit = await startDebit(agent, 'recovery-paquete-4');
      await simulate(debit.externalReference, 'authorize');
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.recoveryPacks).toEqual([expect.objectContaining({ startsOn: today(), sessionsTotal: 4, sessionsLeft: 4 })]);
    });
  });

  describe('charges', () => {
    it('activates the plan on authorization and lists the charge as an automatic debit for staff', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      const res = await simulate(debit.externalReference, 'authorize');
      expect(res.body).toEqual({
        externalReference: debit.externalReference, status: 'authorized', planName: 'Plan Mensual', planSlug: 'performance-mensual',
        service: 'performance', amount: 3900, nextChargeDate: addMonths(today(), 1),
      });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ planName: 'Plan Mensual', startsOn: today(), endsOn: addMonths(today(), 1) });
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);

      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      const all = await staff.get('/api/staff/payments').expect(200);
      expect(all.body.items).toEqual([expect.objectContaining({
        client: expect.objectContaining({ id: userId }), itemName: 'Plan Mensual', amount: 3900, method: 'mercadopago',
        status: 'approved', needsAttention: false, origin: 'auto_debit',
      })]);
      const filtered = await staff.get('/api/staff/payments?origin=auto_debit').expect(200);
      expect(filtered.body.total).toBe(1);
      const oneTime = await staff.get('/api/staff/payments?origin=one_time').expect(200);
      expect(oneTime.body.total).toBe(0);
      await staff.get('/api/staff/payments?origin=gift').expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('marks one-time purchases with their origin', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await agent.post('/api/checkout/plan').send({ planId }).expect(201);
      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      const res = await staff.get('/api/staff/payments?origin=one_time').expect(200);
      expect(res.body.items).toEqual([expect.objectContaining({ origin: 'one_time', status: 'pending' })]);
    });

    it('chains the next Performance period on each later charge (R3)', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await simulate(debit.externalReference, 'authorize');
      const second = await simulate(debit.externalReference, 'charge_approved');
      expect(second.body.nextChargeDate).toBe(addMonths(addMonths(today(), 1), 1));
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ startsOn: today(), endsOn: addMonths(today(), 1) });
      expect(subs.body.upcomingPerformance).toMatchObject({
        startsOn: addDays(addMonths(today(), 1), 1), endsOn: addMonths(addMonths(today(), 1), 1),
      });
      expect(await count(`purchases WHERE auto_debit_id IS NOT NULL AND status = 'approved'`)).toBe(2);
    });

    it('starts a new pack on each Recovery charge', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent, 'recovery-paquete-8');
      await simulate(debit.externalReference, 'authorize');
      await simulate(debit.externalReference, 'charge_approved');
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.recoveryPacks).toHaveLength(2);
      expect(subs.body.recoveryPacks).toEqual([
        expect.objectContaining({ sessionsTotal: 8, startsOn: today() }), expect.objectContaining({ sessionsTotal: 8, startsOn: today() }),
      ]);
    });

    it('charges the amount fixed at checkout after the plan price changes', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await ctx.dataSource.query(`UPDATE plans SET price = 4500 WHERE slug = 'performance-mensual'`);
      await simulate(debit.externalReference, 'authorize');
      const purchases = await ctx.dataSource.query(`SELECT amount, status, needs_attention FROM purchases`);
      expect(purchases).toEqual([{ amount: 3900, status: 'approved', needs_attention: false }]);
      const status = await agent.get(`/api/checkout/auto-debits/${debit.externalReference}`).expect(200);
      expect(status.body.amount).toBe(3900);
    });

    it('lets a client with an authorized Performance debit buy Recovery once but not Performance', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await simulate(debit.externalReference, 'authorize');
      for (const slug of ['performance-mensual', 'performance-trimestral']) {
        const planId = await planIdBySlug(ctx.dataSource, slug);
        await agent.post('/api/checkout/plan').send({ planId }).expect(409).expect(expectCode('AUTO_DEBIT_ACTIVE'));
      }
      const packId = await planIdBySlug(ctx.dataSource, 'recovery-paquete-4');
      await agent.post('/api/checkout/plan').send({ planId: packId }).expect(201);
      expect(await count(`purchases WHERE auto_debit_id IS NULL`)).toBe(1);
    });

    it('still sells Performance once with only a pending, or a Recovery, debit', async () => {
      const { agent } = await signUpClient(ctx.app);
      await startDebit(agent);
      const pack = await startDebit(agent, 'recovery-paquete-4');
      await simulate(pack.externalReference, 'authorize');
      const planId = await planIdBySlug(ctx.dataSource, 'performance-trimestral');
      await agent.post('/api/checkout/plan').send({ planId }).expect(201);
    });

    it('does not charge a debit that is not authorized', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      const res = await simulate(debit.externalReference, 'charge_approved');
      expect(res.body.status).toBe('pending');
      expect(await count('purchases')).toBe(0);
    });
  });

  describe('listing and cancelling', () => {
    it('lists the client debits, latest first', async () => {
      const { agent } = await signUpClient(ctx.app);
      const first = await startDebit(agent);
      await simulate(first.externalReference, 'authorize');
      await startDebit(agent, 'recovery-paquete-4');
      const res = await agent.get('/api/me/auto-debits').expect(200);
      expect(res.body.map((d: { planSlug: string }) => d.planSlug)).toEqual(['recovery-paquete-4', 'performance-mensual']);
      const { id } = await debitRow(first.externalReference);
      expect(res.body[1]).toEqual({
        id, planId: await planIdBySlug(ctx.dataSource, 'performance-mensual'), planName: 'Plan Mensual', planSlug: 'performance-mensual',
        service: 'performance', status: 'authorized', amount: 3900, frequency: 1, frequencyType: 'months',
        nextChargeDate: addMonths(today(), 1), createdAt: expect.any(String), cancelledAt: null, cancelReason: null,
      });
      expect(res.body[0]).toMatchObject({ frequency: 30, frequencyType: 'days', status: 'pending' });
      const other = await signUpClient(ctx.app);
      await other.agent.get('/api/me/auto-debits').expect(200, []);
    });

    it('lets the client cancel and keeps the paid period', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await simulate(debit.externalReference, 'authorize');
      const { id } = await debitRow(debit.externalReference);
      const res = await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      expect(res.body).toMatchObject({ id, status: 'cancelled', cancelReason: 'client', cancelledAt: expect.any(String), nextChargeDate: null });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ endsOn: addMonths(today(), 1) });

      // Cancelling again changes nothing; charges stop and Performance can be bought once again.
      const again = await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      expect(again.body).toEqual(res.body);
      await simulate(debit.externalReference, 'charge_approved');
      expect(await count('purchases')).toBe(1);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await agent.post('/api/checkout/plan').send({ planId }).expect(201);
    });

    it('lets staff cancel a client debit and shows it in the client detail', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const debit = await startDebit(agent, 'recovery-paquete-4');
      await simulate(debit.externalReference, 'authorize');
      const { id } = await debitRow(debit.externalReference);
      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      const before = await staff.get(`/api/staff/clients/${userId}`).expect(200);
      expect(before.body.autoDebits).toEqual([expect.objectContaining({ id, status: 'authorized', planSlug: 'recovery-paquete-4' })]);

      const res = await staff.post(`/api/staff/clients/${userId}/auto-debits/${id}/cancel`).expect(200);
      expect(res.body).toMatchObject({ id, status: 'cancelled', cancelReason: 'staff' });
      const after = await staff.get(`/api/staff/clients/${userId}`).expect(200);
      expect(after.body.autoDebits).toEqual([res.body]);
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.recoveryPacks).toHaveLength(1);
    });

    it('answers AUTO_DEBIT_NOT_FOUND for the debits of another client', async () => {
      const owner = await signUpClient(ctx.app);
      const debit = await startDebit(owner.agent);
      const { id } = await debitRow(debit.externalReference);
      const other = await signUpClient(ctx.app);
      await other.agent.post(`/api/me/auto-debits/${id}/cancel`).expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await other.agent.get(`/api/checkout/auto-debits/${debit.externalReference}`).expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await other.agent.post('/api/me/auto-debits/not-a-uuid/cancel').expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await owner.agent.get('/api/checkout/auto-debits/not-a-uuid').expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));

      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      await staff.post(`/api/staff/clients/${other.userId}/auto-debits/${id}/cancel`).expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await staff.post(`/api/staff/clients/${owner.userId}/auto-debits/not-a-uuid/cancel`).expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await owner.agent.post(`/api/staff/clients/${owner.userId}/auto-debits/${id}/cancel`).expect(403);
      expect(await debitRow(debit.externalReference)).toMatchObject({ status: 'pending' });
    });

    it('records a cancellation made in Mercado Pago', async () => {
      const { agent } = await signUpClient(ctx.app);
      const debit = await startDebit(agent);
      await simulate(debit.externalReference, 'authorize');
      const res = await simulate(debit.externalReference, 'cancel');
      expect(res.body).toMatchObject({ status: 'cancelled', nextChargeDate: null });
      expect(await debitRow(debit.externalReference)).toMatchObject({ status: 'cancelled', cancelReason: 'provider' });
    });
  });

  describe('expiry reminders', () => {
    it('does not send plan-expiring to a client whose Performance debit is authorized', async () => {
      const withDebit = await signUpClient(ctx.app);
      const without = await signUpClient(ctx.app);
      const period = { startsOn: addDays(today(), -27), endsOn: addDays(today(), 3) };
      const debitSub = await givePerformancePlan(ctx.dataSource, withDebit.userId, period);
      const plainSub = await givePerformancePlan(ctx.dataSource, without.userId, period);
      const debit = await startDebit(withDebit.agent);
      await simulate(debit.externalReference, 'authorize');
      const pendingOnly = await signUpClient(ctx.app);
      const pendingSub = await givePerformancePlan(ctx.dataSource, pendingOnly.userId, period);
      await startDebit(pendingOnly.agent);

      const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
      await staff.post('/api/staff/automations/run/expiry-reminders').expect(200);
      const keys = (await ctx.dataSource.query(`SELECT idempotency_key AS key FROM email_logs WHERE template = 'plan-expiring'`))
        .map((row: { key: string }) => row.key);
      expect(keys.sort()).toEqual([`plan-expiring:${plainSub}`, `plan-expiring:${pendingSub}`].sort());
      expect(keys).not.toContain(`plan-expiring:${debitSub}`);
    });
  });

  describe('simulator endpoint', () => {
    it('validates the body and answers AUTO_DEBIT_NOT_FOUND for unknown references', async () => {
      await http().post('/api/payments/dev/simulate-auto-debit')
        .send({ externalReference: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', action: 'authorize' })
        .expect(404).expect(expectCode('AUTO_DEBIT_NOT_FOUND'));
      await http().post('/api/payments/dev/simulate-auto-debit')
        .send({ externalReference: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', action: 'refund' })
        .expect(400).expect(expectCode('VALIDATION_FAILED'));
      await http().post('/api/payments/dev/simulate-auto-debit')
        .send({ externalReference: 'nope', action: 'authorize' })
        .expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });
});

describe('automatic debit checkout throttling (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  it('answers RATE_LIMITED after 10 checkouts a minute', async () => {
    const { agent } = await signUpClient(ctx.app);
    for (let i = 0; i < 10; i += 1) {
      await agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(201);
    }
    const res = await agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(res.headers['retry-after']).toBeDefined();
  });
});
