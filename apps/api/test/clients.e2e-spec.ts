import request from 'supertest';
import type { DataSource } from 'typeorm';
import { addDays, businessDateTime, businessMonth, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import type { Service } from '../src/modules/catalog/entities/plan.entity.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot, givePack, givePerformancePlan, planIdBySlug } from './utils/fixtures.js';

// A confirmed booking (plan source) of a slot at 00:00 local of `date` with an attendance mark.
async function attend(
  ds: DataSource, userId: string, staffId: string, date: string, status = 'present', service: Service = 'performance',
): Promise<string> {
  // Rehab slots belong to a professional and have a single spot.
  const professionalId = service === 'rehab' ? await createProfessional(ds) : undefined;
  const capacity = service === 'rehab' ? 1 : 14;
  const slotId = await createSlot(ds, { service, startsAt: businessDateTime(date, '00:00'), capacity, professionalId });
  const [booking] = await ds.query(
    `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at) VALUES ($1, $2, 'confirmed', 'plan', now()) RETURNING id`,
    [userId, slotId],
  );
  await ds.query(
    `INSERT INTO attendances (booking_id, status, marked_by, marked_at) VALUES ($1, $2, $3, now())`,
    [booking.id, status, staffId],
  );
  return booking.id as string;
}

describe('staff clients, KPIs and dashboard (e2e)', () => {
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

  // A: active plan and attended yesterday. B: plan ending in 3 days. C: never had a plan.
  async function threeClients() {
    const a = await signUp(ctx.app, { name: 'Ana Álvarez' });
    const b = await signUp(ctx.app, { name: 'Bruno Benítez' });
    const c = await signUp(ctx.app, { name: 'Carla Cabrera' });
    await givePerformancePlan(ctx.dataSource, a.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 30) });
    await givePerformancePlan(ctx.dataSource, b.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
    await attend(ctx.dataSource, a.userId, staff.userId, addDays(today(), -1));
    await attend(ctx.dataSource, b.userId, staff.userId, addDays(today(), -1));
    return { a, b, c };
  }

  describe('GET /api/staff/clients', () => {
    it('filters by status, searches without accents and paginates', async () => {
      const { a, b } = await threeClients();

      const active = await staff.agent.get('/api/staff/clients?status=active').expect(200);
      expect(active.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(active.body.items).toEqual([{
        id: a.userId, name: 'Ana Álvarez', email: a.email, status: 'active', pauseReason: null, planName: 'Plan Mensual',
        endsOn: addDays(today(), 30), paymentStatus: 'up_to_date', lastAttendanceOn: addDays(today(), -1),
        frequencyPerWeek: expect.any(Number), rehabCount: 0, recoveryCount: 0,
      }]);

      const byName = await staff.agent.get('/api/staff/clients?q=benitez').expect(200);
      expect(byName.body.items.map((row: { id: string }) => row.id)).toEqual([b.userId]);
      expect(byName.body.items[0].status).toBe('expiring');

      const both = await staff.agent.get('/api/staff/clients?status=active&q=benitez').expect(200);
      expect(both.body).toMatchObject({ total: 0, items: [] });
      const byPlan = await staff.agent.get('/api/staff/clients?q=MENSUAL').expect(200);
      expect(byPlan.body.total).toBe(2);
      const byEmail = await staff.agent.get(`/api/staff/clients?q=${encodeURIComponent(a.email.toUpperCase())}`).expect(200);
      expect(byEmail.body.items.map((row: { id: string }) => row.id)).toEqual([a.userId]);

      const all = await staff.agent.get('/api/staff/clients?status=all').expect(200);
      expect(all.body.items.map((row: { name: string }) => row.name)).toEqual(['Ana Álvarez', 'Bruno Benítez', 'Carla Cabrera']);
      expect(all.body.items[2]).toMatchObject({ status: 'no_plan', planName: null, endsOn: null, paymentStatus: 'none', lastAttendanceOn: null });

      const page1 = await staff.agent.get('/api/staff/clients?page=1&pageSize=2').expect(200);
      expect(page1.body).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(page1.body.items).toHaveLength(2);
      const page2 = await staff.agent.get('/api/staff/clients?page=2&pageSize=2').expect(200);
      expect(page2.body.items.map((row: { name: string }) => row.name)).toEqual(['Carla Cabrera']);
    });

    it('shows paused, expired and inactive clients with their reason and plan', async () => {
      const paused = await signUp(ctx.app, { name: 'Paula Pausa' });
      const expired = await signUp(ctx.app, { name: 'Eva Vencida' });
      const inactive = await signUp(ctx.app, { name: 'Ines Inactiva' });
      await givePerformancePlan(ctx.dataSource, paused.userId, { startsOn: addDays(today(), -5), endsOn: addDays(today(), 30) });
      await givePerformancePlan(ctx.dataSource, expired.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), -10) });
      await givePerformancePlan(ctx.dataSource, inactive.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 30) });
      await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);

      const status = async (s: string) =>
        (await staff.agent.get(`/api/staff/clients?status=${s}`).expect(200)).body.items.map((row: { name: string }) => row.name);
      expect(await status('paused')).toEqual(['Paula Pausa']);
      expect(await status('expired')).toEqual(['Eva Vencida']);
      expect(await status('inactive')).toEqual(['Ines Inactiva']);
      expect(await status('active')).toEqual([]);

      const [pausedRow] = (await staff.agent.get('/api/staff/clients?status=paused').expect(200)).body.items;
      expect(pausedRow).toMatchObject({ status: 'paused', pauseReason: 'injury', paymentStatus: 'up_to_date' });
      const [expiredRow] = (await staff.agent.get('/api/staff/clients?status=expired').expect(200)).body.items;
      expect(expiredRow).toMatchObject({ planName: 'Plan Mensual', endsOn: addDays(today(), -10), paymentStatus: 'overdue' });
    });

    it('leaves out staff and soft-deleted clients', async () => {
      const { a } = await threeClients();
      await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [a.userId]);
      const res = await staff.agent.get('/api/staff/clients').expect(200);
      expect(res.body.total).toBe(2);
      const ids = res.body.items.map((row: { id: string }) => row.id);
      expect(ids).not.toContain(a.userId);
      expect(ids).not.toContain(staff.userId);
    });

    it('rejects invalid filters and out-of-range numbers', async () => {
      const bad = (path: string) => staff.agent.get(path).expect(400).expect(expectCode('VALIDATION_FAILED'));
      await bad('/api/staff/clients?status=bogus');
      await bad('/api/staff/clients?page=0');
      await bad('/api/staff/clients?page=1e20');
      await bad('/api/staff/clients?pageSize=101');
      await bad('/api/staff/clients?pageSize=1e20');
      await bad(`/api/staff/clients?q=${'a'.repeat(101)}`);
      await bad('/api/staff/clients?q=a%00b');
      await bad('/api/staff/clients?q=a&q=b');
    });
  });

  describe('GET /api/staff/clients/kpis', () => {
    it('counts active and expiring clients', async () => {
      await threeClients();
      const res = await staff.agent.get('/api/staff/clients/kpis').expect(200);
      expect(res.body).toMatchObject({ active: 2, expiringSoon: 1, inactive: 0 });
    });

    it('computes every KPI of R11', async () => {
      const monthStart = `${businessMonth(today())}-01`;
      const first =await signUp(ctx.app, { name: 'Nueva Este Mes' });
      const renewed = await signUp(ctx.app, { name: 'Renovó Este Mes' });
      const stale = await signUp(ctx.app, { name: 'Inactiva' });
      const gone = await signUp(ctx.app, { name: 'Ya Se Fue' });
      await givePerformancePlan(ctx.dataSource, first.userId, { startsOn: today(), endsOn: addDays(today(), 30) });
      // Its first subscription started more than a month ago: not a new client of this month.
      await givePerformancePlan(ctx.dataSource, renewed.userId, { startsOn: addDays(today(), -70), endsOn: addDays(today(), -41) });
      await givePerformancePlan(ctx.dataSource, renewed.userId, { startsOn: monthStart, endsOn: addDays(today(), 40) });
      await givePerformancePlan(ctx.dataSource, stale.userId, { startsOn: addDays(monthStart, -10), endsOn: addDays(today(), 30) });
      await givePerformancePlan(ctx.dataSource, gone.userId, { startsOn: addDays(today(), -60), endsOn: addDays(today(), -30) });
      await attend(ctx.dataSource, first.userId, staff.userId, today());
      await attend(ctx.dataSource, renewed.userId, staff.userId, addDays(today(), -1));
      await attend(ctx.dataSource, renewed.userId, staff.userId, today(), 'absent');
      await attend(ctx.dataSource, gone.userId, staff.userId, today(), 'present', 'rehab');
      await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(today(), '12:00'), capacity: 6 });
      const cancelled = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(today(), '13:00'), capacity: 6 });
      await ctx.dataSource.query(`UPDATE time_slots SET cancelled_at = now() WHERE id = $1`, [cancelled]);

      const res = await staff.agent.get('/api/staff/clients/kpis').expect(200);
      expect(res.body).toEqual({
        active: 3, // first, renewed and stale hold a subscription that covers today
        activeDeltaMonth: 1, // only `first` has its first subscription in the current month
        expiringSoon: 0,
        inactive: 1, // stale never attended and its plan started more than 7 days ago
        attendancesToday: 2, // present Performance + present Rehab; the absent mark is not counted
        slotsToday: 4, // three attended slots + one open Recovery slot; the cancelled one is not counted
      });
    });
  });

  describe('POST /api/staff/clients', () => {
    it('creates the account, lists it without plan and sends the invitation once', async () => {
      const res = await staff.agent.post('/api/staff/clients')
        .send({ name: '  Sofía Techera ', email: ' Sote@Test.Move ', phone: '099123456' }).expect(201);
      expect(res.body).toEqual({
        id: expect.any(String), name: 'Sofía Techera', email: 'sote@test.move', status: 'no_plan', pauseReason: null, planName: null,
        endsOn: null, paymentStatus: 'none', lastAttendanceOn: null, frequencyPerWeek: 0, rehabCount: 0, recoveryCount: 0,
      });
      const [user] = await ctx.dataSource.query(`SELECT role, phone FROM users WHERE id = $1`, [res.body.id]);
      expect(user).toEqual({ role: 'client', phone: '099123456' });
      const logs = await ctx.dataSource.query(`SELECT template FROM email_logs WHERE user_id = $1`, [res.body.id]);
      expect(logs).toEqual([{ template: 'account-invitation' }]);

      const list = await staff.agent.get('/api/staff/clients?q=techera').expect(200);
      expect(list.body.items.map((row: { id: string }) => row.id)).toEqual([res.body.id]);
    });

    it('answers EMAIL_ALREADY_REGISTERED for a taken email, whatever its case', async () => {
      await staff.agent.post('/api/staff/clients').send({ name: 'Sofía Techera', email: 'sote@test.move' }).expect(201);
      await staff.agent.post('/api/staff/clients').send({ name: 'Otra Persona', email: 'sote@test.move' })
        .expect(409).expect(expectCode('EMAIL_ALREADY_REGISTERED'));
      await staff.agent.post('/api/staff/clients').send({ name: 'Otra Persona', email: 'SOTE@TEST.MOVE' })
        .expect(409).expect(expectCode('EMAIL_ALREADY_REGISTERED'));
      const existing = await signUpClient(ctx.app);
      await staff.agent.post('/api/staff/clients').send({ name: 'Otra Persona', email: existing.email })
        .expect(409).expect(expectCode('EMAIL_ALREADY_REGISTERED'));
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM email_logs WHERE template = 'account-invitation'`);
      expect(count).toBe(1);
    });

    it('validates the body', async () => {
      const bad = (body: object) => staff.agent.post('/api/staff/clients').send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
      const ok = { name: 'Sofía Techera', email: 'sote@test.move' };
      await bad({ ...ok, name: 'S' });
      await bad({ ...ok, name: 'S'.repeat(81) });
      await bad({ ...ok, name: '    ' });
      await bad({ ...ok, name: 'So\u0000fía' });
      await bad({ ...ok, name: null });
      await bad({ ...ok, email: 'no-es-un-email' });
      await bad({ ...ok, email: `${'a'.repeat(250)}@test.move` });
      await bad({ ...ok, phone: '12345' });
      await bad({ ...ok, phone: '1'.repeat(21) });
      await bad({ ...ok, phone: null });
      await bad({ ...ok, phone: '09\u0000912345' });
      await bad({ ...ok, role: 'staff' });
      await bad({ name: ok.name });
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE role = 'client'`);
      expect(count).toBe(0);
    });
  });

  describe('GET /api/staff/clients/:id', () => {
    it('builds the full detail of a client', async () => {
      const { a } = await threeClients();
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await staff.agent.post('/api/staff/payments/manual').send({ userId: a.userId, planId, method: 'cash', amount: 3900 }).expect(201);
      await givePack(ctx.dataSource, a.userId, { startsOn: addDays(today(), -1), endsOn: addDays(today(), 29), total: 4, used: 1 });
      const futureSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 3), '19:00'), capacity: 14 });
      await ctx.dataSource.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at) VALUES ($1, $2, 'confirmed', 'plan', now())`,
        [a.userId, futureSlot],
      );
      const [alert] = await ctx.dataSource.query(
        `INSERT INTO followup_alerts (user_id, type, period_key) VALUES ($1, 'no_attendance', 'since:x') RETURNING id`, [a.userId],
      );
      await staff.agent.post(`/api/staff/alerts/${alert.id}/contacts`).send({ channel: 'phone', outcome: 'reached', note: 'Llamada' }).expect(201);
      await staff.agent.post(`/api/staff/clients/${a.userId}/inactivity-reasons`).send({ reason: 'injury', note: 'Rodilla' }).expect(201);

      const res = await staff.agent.get(`/api/staff/clients/${a.userId}`).expect(200);
      expect(res.body.client).toMatchObject({
        id: a.userId, name: 'Ana Álvarez', email: a.email, status: 'paused', pauseReason: 'injury', phone: null,
        rehabFollowupEnabled: false, createdAt: expect.any(String),
      });
      expect(res.body.subscription).toMatchObject({ status: 'active', planName: 'Plan Mensual', endsOn: addDays(today(), 30) });
      expect(res.body.upcomingSubscription).toMatchObject({ startsOn: addDays(today(), 31) });
      expect(res.body.recoveryPacks).toEqual([expect.objectContaining({ sessionsTotal: 4, sessionsUsed: 1, sessionsLeft: 3 })]);
      expect(res.body.metrics).toEqual({
        lastAttendanceOn: addDays(today(), -1), frequencyPerWeek: 0.3, attendancesThisMonth: expect.any(Number),
        cancellations: 0, noShows: 0, rehabCount: 0, recoveryCount: 0,
      });
      expect(res.body.activePause).toMatchObject({ reason: 'injury', note: 'Rodilla', endedAt: null });
      expect(res.body.reasons).toHaveLength(1);
      expect(res.body.contacts).toEqual([expect.objectContaining({ channel: 'phone', outcome: 'reached', note: 'Llamada' })]);
      expect(res.body.upcomingBookings).toEqual([expect.objectContaining({ timeSlotId: futureSlot, status: 'confirmed' })]);
      expect(res.body.history.map((item: { type: string }) => item.type)).toEqual(['booking', 'payment', 'attendance']);
      expect(res.body.history[1]).toMatchObject({ amount: 3900, service: 'performance' });
    });

    it('shows a client without activity with empty collections', async () => {
      const { c } = await threeClients();
      const res = await staff.agent.get(`/api/staff/clients/${c.userId}`).expect(200);
      expect(res.body).toMatchObject({
        client: { status: 'no_plan', paymentStatus: 'none' }, subscription: null, upcomingSubscription: null, recoveryPacks: [],
        activePause: null, contacts: [], reasons: [], history: [], upcomingBookings: [],
        metrics: { lastAttendanceOn: null, frequencyPerWeek: 0 },
      });
    });

    it('keeps only the 50 most recent history items', async () => {
      const { a } = await threeClients();
      for (let i = 2; i < 54; i += 1) await attend(ctx.dataSource, a.userId, staff.userId, addDays(today(), -i));
      const res = await staff.agent.get(`/api/staff/clients/${a.userId}`).expect(200);
      expect(res.body.history).toHaveLength(50);
      const dates = res.body.history.map((item: { date: string }) => item.date);
      expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    });

    it('answers CLIENT_NOT_FOUND for unknown, staff and soft-deleted ids', async () => {
      const { a } = await threeClients();
      const notFound = (id: string) => staff.agent.get(`/api/staff/clients/${id}`).expect(404).expect(expectCode('CLIENT_NOT_FOUND'));
      await notFound('3f2c1b8e-6a4d-4c1e-9d55-0a1b2c3d4e5f');
      await notFound(staff.userId);
      await ctx.dataSource.query(`UPDATE users SET deleted_at = now() WHERE id = $1`, [a.userId]);
      await notFound(a.userId);
      await staff.agent.get('/api/staff/clients/not-a-uuid').expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });

  describe('PATCH /api/staff/clients/:id/rehab-followup', () => {
    it('enables and disables the physiotherapy follow-up', async () => {
      const { a } = await threeClients();
      const on = await staff.agent.patch(`/api/staff/clients/${a.userId}/rehab-followup`).send({ enabled: true }).expect(200);
      expect(on.body).toMatchObject({ id: a.userId, name: 'Ana Álvarez', rehabFollowupEnabled: true, status: 'active', phone: null, createdAt: expect.any(String) });
      const detail = await staff.agent.get(`/api/staff/clients/${a.userId}`).expect(200);
      expect(detail.body.client.rehabFollowupEnabled).toBe(true);
      const off = await staff.agent.patch(`/api/staff/clients/${a.userId}/rehab-followup`).send({ enabled: false }).expect(200);
      expect(off.body.rehabFollowupEnabled).toBe(false);
    });

    it('rejects a missing or non-boolean flag and unknown clients', async () => {
      const { a } = await threeClients();
      const path = (id: string) => `/api/staff/clients/${id}/rehab-followup`;
      for (const body of [{}, { enabled: null }, { enabled: 'true' }, { enabled: 1 }, { enabled: true, extra: 1 }]) {
        await staff.agent.patch(path(a.userId)).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
      }
      await staff.agent.patch(path('3f2c1b8e-6a4d-4c1e-9d55-0a1b2c3d4e5f')).send({ enabled: true }).expect(404).expect(expectCode('CLIENT_NOT_FOUND'));
      await staff.agent.patch(path(staff.userId)).send({ enabled: true }).expect(404).expect(expectCode('CLIENT_NOT_FOUND'));
      const [{ enabled }] = await ctx.dataSource.query(`SELECT rehab_followup_enabled AS enabled FROM users WHERE id = $1`, [staff.userId]);
      expect(enabled).toBe(false);
    });
  });

  describe('GET /api/staff/dashboard', () => {
    it('returns the KPIs, alert counters, today slots and pending attendance', async () => {
      const { a } = await threeClients();
      await ctx.dataSource.query(`INSERT INTO followup_alerts (user_id, type, period_key) VALUES ($1, 'expiring', 'sub:x')`, [a.userId]);
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(today(), '00:00'), capacity: 14 });
      await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '19:00'), capacity: 14 });
      const pendingSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), -2), '19:00'), capacity: 14 });
      await ctx.dataSource.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at) VALUES ($1, $2, 'confirmed', 'plan', now())`,
        [a.userId, pendingSlot],
      );

      const res = await staff.agent.get('/api/staff/dashboard').expect(200);
      expect(res.body.kpis).toMatchObject({ active: 2, expiringSoon: 1, slotsToday: 1 });
      expect(res.body.alertCounts).toMatchObject({ expiring: 1, total: 1 });
      expect(res.body.todaySlots.map((slot: { id: string }) => slot.id)).toContain(slotId);
      expect(res.body.todaySlots).toHaveLength(1);
      expect(res.body.pendingAttendanceSlots).toBe(1);
    });

    it('works on an empty database', async () => {
      const res = await staff.agent.get('/api/staff/dashboard').expect(200);
      expect(res.body).toEqual({
        kpis: { active: 0, activeDeltaMonth: 0, expiringSoon: 0, inactive: 0, attendancesToday: 0, slotsToday: 0 },
        alertCounts: expect.objectContaining({ total: 0 }),
        todaySlots: [],
        pendingAttendanceSlots: 0,
      });
    });
  });

  describe('access control', () => {
    type Caller = {
      get(url: string): request.Test;
      post(url: string): request.Test;
      patch(url: string): request.Test;
    };
    type Call = ['get' | 'post' | 'patch', string, object?];
    const send = (who: Caller, [method, path, body]: Call): request.Test => {
      const pending = who[method](path);
      return body ? pending.send(body) : pending;
    };

    it('answers 403 to a client and 401 without session', async () => {
      const client = await signUpClient(ctx.app);
      const id = client.userId;
      const calls: Call[] = [
        ['get', '/api/staff/clients'], ['get', '/api/staff/clients/kpis'], ['get', `/api/staff/clients/${id}`],
        ['post', '/api/staff/clients', { name: 'Sofía Techera', email: 'sote@test.move' }],
        ['patch', `/api/staff/clients/${id}/rehab-followup`, { enabled: true }], ['get', '/api/staff/dashboard'],
      ];
      for (const call of calls) {
        await send(client.agent, call).expect(403).expect(expectCode('FORBIDDEN'));
        await send(request(ctx.app.getHttpServer()), call).expect(401).expect(expectCode('UNAUTHENTICATED'));
      }
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users WHERE email = 'sote@test.move'`);
      expect(count).toBe(0);
      const [{ enabled }] = await ctx.dataSource.query(`SELECT rehab_followup_enabled AS enabled FROM users WHERE id = $1`, [id]);
      expect(enabled).toBe(false);
    });
  });
});
