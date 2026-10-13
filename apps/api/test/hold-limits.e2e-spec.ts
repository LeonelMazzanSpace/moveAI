import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createSlot, planIdBySlug } from './utils/fixtures.js';

// D53. Every test gets a fresh app, so the in-memory throttler counters start at zero; the throttler keeps its
// production limit (10 requests per minute per IP) in this file.
describe('payment holds and checkout throttling (e2e)', () => {
  let ctx: TestApp;
  beforeEach(async () => {
    ctx = await createTestApp();
    await resetDb(ctx.dataSource);
    await seedCatalogAndSchedule(ctx.dataSource);
  });
  afterEach(async () => { await ctx.app.close(); });

  const http = () => request(ctx.app.getHttpServer());
  const expectCode = (code: string) => (r: request.Response) => expect(r.body.code).toBe(code);
  const tomorrowAt = (time: string) => businessDateTime(addDays(businessToday(), 1), time);
  const recoverySlot = (time: string, capacity = 2) =>
    createSlot(ctx.dataSource, { service: 'recovery', startsAt: tomorrowAt(time), capacity });
  const guest = () => ({ name: 'Invitada Test', email: `guest-${randomUUID()}@test.move`, phone: '099123456' });
  const count = async (table: string): Promise<number> => {
    const [row]: { count: number }[] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM ${table}`);
    return row.count;
  };
  const counts = async () => ({
    users: await count('users'), bookings: await count('bookings'), purchases: await count('purchases'), emails: await count('email_logs'),
  });

  async function holdTwo(agent: TestAgent, planId: string): Promise<string[]> {
    const refs: string[] = [];
    for (const time of ['08:00', '09:00']) {
      const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: await recoverySlot(time) }).expect(201);
      refs.push(res.body.externalReference as string);
    }
    return refs;
  }

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

  describe('active holds per user', () => {
    it('rejects a third active hold without creating a booking or a purchase', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      await holdTwo(agent, planId);
      const before = await counts();

      const third = await recoverySlot('10:00');
      const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: third }).expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        code: 'HOLD_LIMIT_REACHED',
        message: 'Ya tenés reservas pendientes de pago. Completá el pago o esperá a que venzan.',
      });
      expect(await counts()).toEqual(before);
    });

    it('lets the client hold again once a hold is past its expiry, even before the expiry job runs', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      const [first] = await holdTwo(agent, planId);
      await ctx.dataSource.query(
        `UPDATE bookings SET hold_expires_at = now() - interval '1 minute'
         WHERE id = (SELECT booking_id FROM purchases WHERE external_reference = $1)`,
        [first],
      );
      const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: await recoverySlot('10:00') }).expect(201);
      expect(res.body.holdExpiresAt).toEqual(expect.any(String));
    });

    it('lets the client hold again once a hold is paid', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      const [first] = await holdTwo(agent, planId);
      await http().post('/api/payments/dev/simulate').send({ externalReference: first, outcome: 'approved' }).expect(200);
      await agent.post('/api/checkout/booking').send({ planId, timeSlotId: await recoverySlot('10:00') }).expect(201);
    });

    it('counts only the holds of the same user', async () => {
      const a = await signUpClient(ctx.app);
      const b = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      await holdTwo(a.agent, planId);
      await b.agent.post('/api/checkout/booking').send({ planId, timeSlotId: await recoverySlot('10:00') }).expect(201);
    });

    it('serializes concurrent holds of the same user on different slots', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      await agent.post('/api/checkout/booking').send({ planId, timeSlotId: await recoverySlot('08:00') }).expect(201);
      const slotA = await recoverySlot('09:00');
      const slotB = await recoverySlot('10:00');

      // Barrier: a separate connection holds both slot locks, so both checkouts are in flight before either counts.
      const gate = ctx.dataSource.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      let pending: Promise<request.Response[]> | undefined;
      try {
        await gate.query(`SELECT id FROM time_slots WHERE id IN ($1, $2) FOR UPDATE`, [slotA, slotB]);
        pending = Promise.all([
          agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotA }),
          agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotB }),
        ]);
        await waitForLockWaiters(2);
      } finally {
        await gate.commitTransaction();
        await gate.release();
      }
      const results = await pending;
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([201, 409]);
      expect(results.find((r) => r.status === 409)?.body.code).toBe('HOLD_LIMIT_REACHED');
      expect(await count(`bookings WHERE status = 'pending_payment'`)).toBe(2);
    });
  });

  describe('throttling', () => {
    it('limits guest checkouts to 10 per minute per IP without side effects on the 11th', async () => {
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      const timeSlotId = await recoverySlot('08:00', 20);
      for (let i = 0; i < 10; i += 1) {
        await http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }).expect(201);
      }
      const before = await counts();
      expect(before).toMatchObject({ users: 10, purchases: 10, emails: 10 });

      const res = await http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }).expect(429);
      expect(res.body).toEqual({
        statusCode: 429,
        code: 'RATE_LIMITED',
        message: 'Hiciste demasiados intentos. Esperá un rato y probá de nuevo.',
      });
      expect(res.headers['retry-after']).toEqual(expect.any(String));
      expect(await counts()).toEqual(before);
    });

    it('counts rejected checkouts too', async () => {
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      for (let i = 0; i < 10; i += 1) {
        await http().post('/api/checkout/booking').send({ planId, timeSlotId: randomUUID(), guest: guest() }).expect(404);
      }
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: randomUUID(), guest: guest() })
        .expect(429).expect(expectCode('RATE_LIMITED'));
    });

    it('limits client plan checkouts to 10 per minute per IP', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      for (let i = 0; i < 10; i += 1) {
        await agent.post('/api/checkout/plan').send({ planId }).expect(201);
      }
      await agent.post('/api/checkout/plan').send({ planId }).expect(429).expect(expectCode('RATE_LIMITED'));
      expect(await count('purchases')).toBe(10);
    });

    // D58: the throttler reads Date.now(), so moving it past each minute window simulates an hour without waiting.
    describe('hourly window', () => {
      let offset = 0;
      beforeEach(() => {
        offset = 0;
        const realNow = Date.now.bind(Date);
        vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
      });
      afterEach(() => { vi.restoreAllMocks(); });

      async function spreadOverMinutes(send: () => request.Test): Promise<void> {
        for (let minute = 0; minute < 2; minute += 1) {
          for (let i = 0; i < 10; i += 1) await send().expect(201);
          offset += 61_000;
        }
      }

      it('limits guest checkouts to 20 per hour per IP even when no minute goes over 10', async () => {
        const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
        const timeSlotId = await recoverySlot('08:00', 25);
        await spreadOverMinutes(() => http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }));
        const before = await counts();
        expect(before).toMatchObject({ users: 20, purchases: 20 });

        const res = await http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }).expect(429);
        expect(res.body).toEqual({
          statusCode: 429,
          code: 'RATE_LIMITED',
          message: 'Hiciste demasiados intentos. Esperá un rato y probá de nuevo.',
        });
        expect(res.headers['retry-after']).toEqual(expect.any(String));
        expect(await counts()).toEqual(before);
      });

      it('does not apply the hourly window to plan checkouts', async () => {
        const { agent } = await signUpClient(ctx.app);
        const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
        await spreadOverMinutes(() => agent.post('/api/checkout/plan').send({ planId }));
        await agent.post('/api/checkout/plan').send({ planId }).expect(201);
        expect(await count('purchases')).toBe(21);
      });
    });

    it('does not throttle the other endpoints', async () => {
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      const timeSlotId = await recoverySlot('08:00', 20);
      const refs: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const res = await http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }).expect(201);
        refs.push(res.body.externalReference as string);
      }
      await http().post('/api/checkout/booking').send({ planId, timeSlotId, guest: guest() }).expect(429);

      for (let i = 0; i < 12; i += 1) {
        await http().get(`/api/checkout/purchases/${refs[i % refs.length]}`).expect(200);
        await http().get('/api/catalog/plans?service=recovery').expect(200);
        await http().get(`/api/schedule/time-slots?service=recovery&date=${addDays(businessToday(), 1)}`).expect(200);
      }
      for (const externalReference of refs.slice(0, 2)) {
        await http().post('/api/payments/dev/simulate').send({ externalReference, outcome: 'rejected' }).expect(200);
      }
    });
  });
});
