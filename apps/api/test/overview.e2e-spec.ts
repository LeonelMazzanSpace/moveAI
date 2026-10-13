import request from 'supertest';
import type { DataSource } from 'typeorm';
import { addDays, businessDateTime, businessMonth, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createSlot, givePack, givePerformancePlan, planIdBySlug } from './utils/fixtures.js';

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

async function insertBooking(
  ds: DataSource, userId: string, date: string, time: string, extra: { status?: string; cancelledBy?: string } = {},
): Promise<string> {
  const slotId = await createSlot(ds, { service: 'performance', startsAt: businessDateTime(date, time), capacity: 14 });
  const status = extra.status ?? 'confirmed';
  const [booking] = await ds.query(
    `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at, cancelled_at, cancelled_by)
     VALUES ($1, $2, $3, 'plan', now(), $4, $5) RETURNING id`,
    [userId, slotId, status, status === 'cancelled' ? new Date() : null, extra.cancelledBy ?? null],
  );
  return booking.id as string;
}

async function markPresent(ds: DataSource, bookingId: string, staffId: string): Promise<void> {
  await ds.query(`INSERT INTO attendances (booking_id, status, marked_by, marked_at) VALUES ($1, 'present', $2, now())`, [bookingId, staffId]);
}

describe('client overview: activity, stats and notices (e2e)', () => {
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

  // One approved payment (now), one attendance (today 00:00 local) and one booking three days ahead.
  async function clientWithActivity() {
    const client = await signUpClient(ctx.app);
    const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId, method: 'cash', amount: 3900 }).expect(201);
    await markPresent(ctx.dataSource, await insertBooking(ctx.dataSource, client.userId, today(), '00:00'), staff.userId);
    await insertBooking(ctx.dataSource, client.userId, addDays(today(), 3), '19:00');
    return client;
  }

  describe('GET /api/me/activity', () => {
    it('mixes payments, attendances and bookings, newest first, and filters by type', async () => {
      const client = await clientWithActivity();
      const other = await signUpClient(ctx.app);
      await insertBooking(ctx.dataSource, other.userId, addDays(today(), 2), '19:00');

      const all = await client.agent.get('/api/me/activity').expect(200);
      expect(all.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
      expect(all.body.items.map((item: { type: string }) => item.type)).toEqual(['booking', 'payment', 'attendance']);
      const dates = all.body.items.map((item: { date: string }) => item.date);
      expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
      expect(all.body.items[1]).toMatchObject({ label: 'Pago — Plan Mensual', amount: 3900, service: 'performance' });
      expect(all.body.items[0]).toMatchObject({ amount: null, service: 'performance' });

      const payments = await client.agent.get('/api/me/activity?type=payments').expect(200);
      expect(payments.body.total).toBe(1);
      expect(payments.body.items).toEqual([expect.objectContaining({ type: 'payment', amount: 3900 })]);

      const bookings = await client.agent.get('/api/me/activity?type=bookings').expect(200);
      expect(bookings.body.items.map((item: { type: string }) => item.type)).toEqual(['booking', 'attendance']);
    });

    it('includes cancellations under bookings and paginates after sorting', async () => {
      const client = await clientWithActivity();
      await insertBooking(ctx.dataSource, client.userId, addDays(today(), 1), '10:00', { status: 'cancelled', cancelledBy: 'client' });

      const bookings = await client.agent.get('/api/me/activity?type=bookings').expect(200);
      expect(bookings.body.items.map((item: { type: string }) => item.type)).toEqual(['booking', 'cancellation', 'attendance']);

      const page1 = await client.agent.get('/api/me/activity?page=1&pageSize=3').expect(200);
      expect(page1.body).toMatchObject({ total: 4, page: 1, pageSize: 3 });
      expect(page1.body.items).toHaveLength(3);
      const page2 = await client.agent.get('/api/me/activity?page=2&pageSize=3').expect(200);
      expect(page2.body.items.map((item: { type: string }) => item.type)).toEqual(['attendance']);
      const beyond = await client.agent.get('/api/me/activity?page=9&pageSize=3').expect(200);
      expect(beyond.body).toMatchObject({ total: 4, items: [] });
    });

    it('is empty for a client without activity and rejects invalid queries', async () => {
      const client = await signUpClient(ctx.app);
      const empty = await client.agent.get('/api/me/activity').expect(200);
      expect(empty.body).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
      const bad = (path: string) => client.agent.get(path).expect(400).expect(expectCode('VALIDATION_FAILED'));
      await bad('/api/me/activity?type=bogus');
      await bad('/api/me/activity?page=0');
      await bad('/api/me/activity?page=1e20');
      await bad('/api/me/activity?pageSize=101');
    });
  });

  describe('GET /api/me/stats', () => {
    it('reports this month attendances and the weekly average', async () => {
      const client = await clientWithActivity();
      const res = await client.agent.get('/api/me/stats').expect(200);
      expect(res.body).toEqual({ month: businessMonth(today()), attendances: 1, avgPerWeek: 0.3 });
    });

    it('is zero for a client who never attended', async () => {
      const client = await signUpClient(ctx.app);
      const res = await client.agent.get('/api/me/stats').expect(200);
      expect(res.body).toEqual({ month: businessMonth(today()), attendances: 0, avgPerWeek: 0 });
    });
  });

  describe('GET /api/me/notices', () => {
    it('is empty for a new client and for a plan that is not near its end', async () => {
      const client = await signUpClient(ctx.app);
      expect((await client.agent.get('/api/me/notices').expect(200)).body).toEqual([]);
      await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 30) });
      expect((await client.agent.get('/api/me/notices').expect(200)).body).toEqual([]);
    });

    it('puts the expiring plan first', async () => {
      const client = await signUpClient(ctx.app);
      const subId = await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
      const res = await client.agent.get('/api/me/notices').expect(200);
      expect(res.body).toEqual([{
        id: `plan_expiring:${subId}`, kind: 'plan_expiring', title: 'Tu plan vence en 3 días',
        body: 'Renová para no perder tus reservas.', actionUrl: '/planes?service=performance',
      }]);
    });

    it('drops the expiring notice once the client renewed (D49)', async () => {
      const client = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -27), endsOn: addDays(today(), 3) });
      expect((await client.agent.get('/api/me/notices').expect(200)).body).toHaveLength(1);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId, method: 'cash', amount: 3900 }).expect(201);
      const subs = await client.agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.upcomingPerformance).not.toBeNull();
      expect((await client.agent.get('/api/me/notices').expect(200)).body).toEqual([]);
    });

    it('words the low pack notice for the exhausted case', async () => {
      const client = await signUpClient(ctx.app);
      await givePack(ctx.dataSource, client.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 25), total: 4, used: 4 });
      const res = await client.agent.get('/api/me/notices').expect(200);
      expect(res.body).toEqual([expect.objectContaining({ kind: 'pack_low', title: 'No te quedan sesiones de Recovery' })]);
    });

    it('flags an expired plan', async () => {
      const client = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), -5) });
      const res = await client.agent.get('/api/me/notices').expect(200);
      expect(res.body).toEqual([expect.objectContaining({ kind: 'plan_expired', title: 'Tu plan venció', actionUrl: '/planes?service=performance' })]);
    });

    it('lists check-ins and low packs after the plan, in contract order', async () => {
      const client = await signUpClient(ctx.app);
      const month = businessMonth(today());
      const previousMonth = businessMonth(addDays(`${month}-01`, -1));
      await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
      const lowPack = await givePack(ctx.dataSource, client.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 25), total: 4, used: 3 });
      await givePack(ctx.dataSource, client.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 25), total: 8, used: 1 });
      await ctx.dataSource.query(`INSERT INTO checkins (user_id, period, status) VALUES ($1, $2, 'sent')`, [client.userId, previousMonth]);
      await ctx.dataSource.query(
        `INSERT INTO checkins (user_id, period, status, responded_at, feeling, pain, goals, flag)
         VALUES ($1, $2, 'answered', now(), 'good', 'none', 'same', 'ok')`,
        [client.userId, month],
      );

      const res = await client.agent.get('/api/me/notices').expect(200);
      expect(res.body.map((notice: { kind: string }) => notice.kind)).toEqual([
        'plan_expiring', 'checkin_pending', 'checkin_answered', 'pack_low',
      ]);
      expect(res.body[1]).toMatchObject({ title: 'Tenés un check-in pendiente', actionUrl: '/check-in' });
      expect(res.body[2]).toMatchObject({ title: `Check-in de ${MONTH_NAMES[Number(month.slice(5)) - 1]} respondido`, actionUrl: null });
      expect(res.body[3]).toMatchObject({ id: `pack_low:${lowPack}`, title: 'Te queda 1 sesión de Recovery', actionUrl: '/planes?service=recovery' });
    });

    it('does not show another client\'s notices', async () => {
      const client = await signUpClient(ctx.app);
      const other = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, other.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
      expect((await client.agent.get('/api/me/notices').expect(200)).body).toEqual([]);
    });
  });

  describe('access control', () => {
    it('answers 403 to staff and 401 without session', async () => {
      for (const path of ['/api/me/activity', '/api/me/stats', '/api/me/notices']) {
        await staff.agent.get(path).expect(403).expect(expectCode('FORBIDDEN'));
        await request(ctx.app.getHttpServer()).get(path).expect(401).expect(expectCode('UNAUTHENTICATED'));
      }
    });
  });
});
