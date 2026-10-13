import request from 'supertest';
import { addDays, businessDateTime, businessDayStart, businessMonth, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { ActivityMetricsService } from '../src/modules/bookings/services/activity-metrics.service.js';
import { AttendanceService } from '../src/modules/bookings/services/attendance.service.js';
import { SlotStatsService } from '../src/modules/bookings/services/slot-stats.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot, givePack, givePerformancePlan } from './utils/fixtures.js';

describe('attendance and staff slots (e2e)', () => {
  let ctx: TestApp;
  let staff: TestAgent;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => {
    await resetDb(ctx.dataSource);
    await seedCatalogAndSchedule(ctx.dataSource);
    staff = (await signUpStaff(ctx.app, ctx.dataSource)).agent;
  });

  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
  const today = () => businessToday();
  // A slot of today that already started (never before today's 00:00 local).
  const startedToday = () => new Date(Math.max(businessDayStart(today()).getTime(), Date.now() - 30 * 60_000));

  async function book(userId: string, slotId: string, status = 'confirmed', source = 'plan'): Promise<string> {
    const [row] = await ctx.dataSource.query(
      `INSERT INTO bookings (user_id, time_slot_id, status, source, cancelled_at, cancelled_by)
       VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'cancelled' THEN now() END, CASE WHEN $3 = 'cancelled' THEN 'client' END)
       RETURNING id`,
      [userId, slotId, status, source],
    );
    return row.id as string;
  }

  it('marks attendance and corrects it with a single row', async () => {
    const { userId } = await signUp(ctx.app, { name: 'Martina Suárez' });
    await givePerformancePlan(ctx.dataSource, userId, { startsOn: addDays(today(), -10), endsOn: addDays(today(), 20) });
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: startedToday(), capacity: 14 });
    const bookingId = await book(userId, slotId);

    const present = await staff.put(`/api/staff/bookings/${bookingId}/attendance`).send({ status: 'present' }).expect(200);
    expect(present.body).toEqual({
      bookingId, client: { id: userId, name: 'Martina Suárez' }, planName: 'Plan Mensual', lastAttendanceOn: today(),
      status: 'confirmed', attendance: 'present', cancelledAt: null,
    });
    const corrected = await staff.put(`/api/staff/bookings/${bookingId}/attendance`).send({ status: 'no_show' }).expect(200);
    expect(corrected.body).toMatchObject({ attendance: 'no_show', lastAttendanceOn: null });
    const rows = await ctx.dataSource.query(`SELECT status FROM attendances WHERE booking_id = $1`, [bookingId]);
    expect(rows).toEqual([{ status: 'no_show' }]);
  });

  it('allows attendance only on confirmed bookings of today or earlier', async () => {
    const { userId } = await signUpClient(ctx.app);
    const tomorrowSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '07:00'), capacity: 14 });
    const pastSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), -1), '19:00'), capacity: 14 });
    const future = await book(userId, tomorrowSlot);
    const cancelled = await book(userId, pastSlot, 'cancelled');
    await staff.put(`/api/staff/bookings/${future}/attendance`).send({ status: 'present' }).expect(409).expect(expectCode('ATTENDANCE_NOT_ALLOWED'));
    await staff.put(`/api/staff/bookings/${cancelled}/attendance`).send({ status: 'absent' }).expect(409).expect(expectCode('ATTENDANCE_NOT_ALLOWED'));
    await staff.put('/api/staff/bookings/11111111-1111-4111-8111-111111111111/attendance').send({ status: 'present' })
      .expect(404).expect(expectCode('BOOKING_NOT_FOUND'));
    const confirmed = await book(userId, pastSlot);
    for (const body of [{ status: 'late' }, {}, { status: null }]) {
      await staff.put(`/api/staff/bookings/${confirmed}/attendance`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
    await staff.put(`/api/staff/bookings/${confirmed}/attendance`).send({ status: 'absent' }).expect(200)
      .expect((r) => expect(r.body.attendance).toBe('absent'));
  });

  it('lists the roster with active bookings first and cancelled ones last', async () => {
    const ana = await signUp(ctx.app, { name: 'Ana López' });
    const bruno = await signUp(ctx.app, { name: 'Bruno Díaz' });
    const aaron = await signUp(ctx.app, { name: 'Aarón Pérez' });
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: startedToday(), capacity: 14 });
    const brunoBooking = await book(bruno.userId, slotId);
    const anaBooking = await book(ana.userId, slotId);
    const aaronBooking = await book(aaron.userId, slotId, 'cancelled');
    await staff.put(`/api/staff/bookings/${anaBooking}/attendance`).send({ status: 'present' }).expect(200);

    const roster = await staff.get(`/api/staff/time-slots/${slotId}/roster`).expect(200);
    expect(roster.body).toMatchObject({ total: 3, page: 1, pageSize: 20 });
    expect(roster.body.items.map((i: { bookingId: string; attendance: string | null; status: string }) => [i.bookingId, i.status, i.attendance])).toEqual([
      [anaBooking, 'confirmed', 'present'],
      [brunoBooking, 'confirmed', null],
      [aaronBooking, 'cancelled', null],
    ]);
    expect(roster.body.items[2].cancelledAt).toEqual(expect.any(String));
    expect(roster.body.items[0]).toMatchObject({ client: { id: ana.userId, name: 'Ana López' }, planName: null, lastAttendanceOn: today() });
    expect(roster.body.items[1]).toMatchObject({ client: { id: bruno.userId, name: 'Bruno Díaz' }, lastAttendanceOn: null });

    const page2 = await staff.get(`/api/staff/time-slots/${slotId}/roster?page=2&pageSize=2`).expect(200);
    expect(page2.body).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(page2.body.items.map((i: { bookingId: string }) => i.bookingId)).toEqual([aaronBooking]);
    await staff.get(`/api/staff/time-slots/${slotId}/roster?pageSize=101`).expect(400).expect(expectCode('VALIDATION_FAILED'));
    await staff.get('/api/staff/time-slots/11111111-1111-4111-8111-111111111111/roster').expect(404).expect(expectCode('SLOT_NOT_FOUND'));
  });

  it('lists the staff day with attendance counters, including cancelled slots', async () => {
    const users = await Promise.all(Array.from({ length: 5 }, () => signUpClient(ctx.app)));
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: startedToday(), capacity: 14 });
    const cancelledSlot = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: startedToday(), capacity: 2 });
    await ctx.dataSource.query(`UPDATE time_slots SET cancelled_at = now() WHERE id = $1`, [cancelledSlot]);
    const [present, absent, noShow] = await Promise.all(users.slice(0, 3).map((u) => book(u.userId, slotId)));
    await book(users[3].userId, slotId);
    await book(users[4].userId, slotId, 'cancelled');
    await staff.put(`/api/staff/bookings/${present}/attendance`).send({ status: 'present' }).expect(200);
    await staff.put(`/api/staff/bookings/${absent}/attendance`).send({ status: 'absent' }).expect(200);
    await staff.put(`/api/staff/bookings/${noShow}/attendance`).send({ status: 'no_show' }).expect(200);

    const res = await staff.get(`/api/staff/time-slots?date=${today()}`).expect(200);
    expect(res.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({
      service: 'performance', capacity: 14, cancelledAt: null, professional: null,
      booked: 4, present: 1, absent: 1, noShow: 1, cancelled: 1, pendingAttendance: 1,
    });
    expect(res.body.find((s: { id: string }) => s.id === cancelledSlot)?.cancelledAt).toEqual(expect.any(String));
    const filtered = await staff.get(`/api/staff/time-slots?date=${today()}&service=recovery`).expect(200);
    expect(filtered.body.map((s: { id: string }) => s.id)).toEqual([cancelledSlot]);
    await staff.get('/api/staff/time-slots').expect(400).expect(expectCode('VALIDATION_FAILED'));
    await staff.get('/api/staff/time-slots?date=12-10-2026').expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('flags past slots with pending attendance', async () => {
    const { userId } = await signUpClient(ctx.app);
    const yesterday = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), -1), '19:00'), capacity: 14 });
    const marked = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), -1), '20:00'), capacity: 14 });
    const old = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), -20), '19:00'), capacity: 14 });
    const future = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '19:00'), capacity: 14 });
    await book(userId, yesterday);
    const markedBooking = await book(userId, marked);
    await book(userId, old);
    await book(userId, future);
    await staff.put(`/api/staff/bookings/${markedBooking}/attendance`).send({ status: 'present' }).expect(200);

    const res = await staff.get('/api/staff/time-slots/pending-attendance').expect(200);
    expect(res.body.map((s: { id: string }) => s.id)).toEqual([yesterday]);
    expect(res.body[0]).toMatchObject({ booked: 1, pendingAttendance: 1 });
  });

  it('cancels a slot only without active bookings', async () => {
    const { userId } = await signUpClient(ctx.app);
    const busy = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '19:00'), capacity: 14 });
    const empty = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '20:00'), capacity: 14 });
    await book(userId, busy);
    await book(userId, empty, 'cancelled');
    await staff.post(`/api/staff/time-slots/${busy}/cancel`).expect(409).expect(expectCode('SLOT_HAS_BOOKINGS'));
    const res = await staff.post(`/api/staff/time-slots/${empty}/cancel`).expect(200);
    expect(res.body).toMatchObject({ id: empty, booked: 0, cancelled: 1 });
    expect(res.body.cancelledAt).toEqual(expect.any(String));
    await staff.post('/api/staff/time-slots/11111111-1111-4111-8111-111111111111/cancel').expect(404).expect(expectCode('SLOT_NOT_FOUND'));
  });

  it('changes capacity but never below the active bookings', async () => {
    const users = await Promise.all([signUpClient(ctx.app), signUpClient(ctx.app)]);
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(today(), 1), '19:00'), capacity: 14 });
    for (const u of users) await book(u.userId, slotId);
    await staff.patch(`/api/staff/time-slots/${slotId}`).send({ capacity: 1 }).expect(409).expect(expectCode('CAPACITY_BELOW_BOOKED'));
    const res = await staff.patch(`/api/staff/time-slots/${slotId}`).send({ capacity: 2 }).expect(200);
    expect(res.body).toMatchObject({ id: slotId, capacity: 2, booked: 2 });
    for (const body of [{ capacity: 0 }, { capacity: 101 }, { capacity: null }, { capacity: 1e20 }, {}, { capacity: 3, service: 'rehab' }]) {
      await staff.patch(`/api/staff/time-slots/${slotId}`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
    await staff.patch('/api/staff/time-slots/11111111-1111-4111-8111-111111111111').send({ capacity: 3 }).expect(404).expect(expectCode('SLOT_NOT_FOUND'));
  });

  it('lets staff cancel any active booking, returns the pack session and emails the client', async () => {
    const { userId } = await signUp(ctx.app, { name: 'Lucía Gómez' });
    const packId = await givePack(ctx.dataSource, userId, { startsOn: today(), endsOn: addDays(today(), 29), total: 4, used: 1 });
    const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: new Date(Date.now() + 30 * 60_000), capacity: 2 });
    const [row] = await ctx.dataSource.query(
      `INSERT INTO bookings (user_id, time_slot_id, status, source, subscription_id) VALUES ($1, $2, 'confirmed', 'package', $3) RETURNING id`,
      [userId, slotId, packId],
    );

    const res = await staff.post(`/api/staff/bookings/${row.id}/cancel`).expect(200);
    expect(res.body).toMatchObject({ bookingId: row.id, client: { id: userId, name: 'Lucía Gómez' }, status: 'cancelled' });
    expect(res.body.cancelledAt).toEqual(expect.any(String));
    const [booking] = await ctx.dataSource.query(`SELECT cancelled_by FROM bookings WHERE id = $1`, [row.id]);
    expect(booking.cancelled_by).toBe('staff');
    const [pack] = await ctx.dataSource.query(`SELECT sessions_used FROM subscriptions WHERE id = $1`, [packId]);
    expect(pack.sessions_used).toBe(0);
    const [log] = await ctx.dataSource.query(`SELECT template, user_id FROM email_logs WHERE idempotency_key = $1`, [`booking-cancelled:${row.id}`]);
    expect(log).toEqual({ template: 'booking-cancelled', user_id: userId });

    await staff.post(`/api/staff/bookings/${row.id}/cancel`).expect(409).expect(expectCode('BOOKING_NOT_CANCELLABLE'));
    await staff.post('/api/staff/bookings/11111111-1111-4111-8111-111111111111/cancel').expect(404).expect(expectCode('BOOKING_NOT_FOUND'));
  });

  it('computes client metrics and daily counters', async () => {
    const { userId } = await signUpClient(ctx.app);
    const idle = await signUpClient(ctx.app);
    const pro = await createProfessional(ctx.dataSource);
    const performanceAt = (offset: number) => (offset === 0 ? startedToday() : businessDateTime(addDays(today(), offset), '19:00'));
    const presentOffsets = [0, -3, -10, -20, -100];
    for (const offset of presentOffsets) {
      const bookingId = await book(userId, await createSlot(ctx.dataSource, { service: 'performance', startsAt: performanceAt(offset), capacity: 14 }));
      await staff.put(`/api/staff/bookings/${bookingId}/attendance`).send({ status: 'present' }).expect(200);
    }
    const noShow = await book(userId, await createSlot(ctx.dataSource, { service: 'performance', startsAt: performanceAt(-5), capacity: 14 }));
    await staff.put(`/api/staff/bookings/${noShow}/attendance`).send({ status: 'no_show' }).expect(200);
    const recovery = await book(userId, await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(addDays(today(), -3), '08:00'), capacity: 2 }), 'confirmed', 'package');
    await staff.put(`/api/staff/bookings/${recovery}/attendance`).send({ status: 'present' }).expect(200);
    await book(userId, await createSlot(ctx.dataSource, { service: 'rehab', startsAt: businessDateTime(addDays(today(), 2), '09:00'), capacity: 1, professionalId: pro }), 'confirmed', 'followup');
    await book(userId, await createSlot(ctx.dataSource, { service: 'performance', startsAt: performanceAt(2), capacity: 14 }), 'cancelled');
    const staffCancelled = await book(userId, await createSlot(ctx.dataSource, { service: 'performance', startsAt: performanceAt(3), capacity: 14 }));
    await staff.post(`/api/staff/bookings/${staffCancelled}/cancel`).expect(200);

    const metricsService = ctx.app.get(ActivityMetricsService);
    const metrics = await metricsService.getMetrics([userId, idle.userId], today());
    const thisMonth = presentOffsets.filter((offset) => businessMonth(addDays(today(), offset)) === businessMonth(today())).length;
    expect(metrics.get(userId)).toEqual({
      lastAttendanceOn: today(), frequencyPerWeek: 1, attendancesThisMonth: thisMonth,
      cancellations: 1, noShows: 1, rehabCount: 1, recoveryCount: 1,
      recentFrequency: 1.5, baselineFrequency: 0.125, usualFrequencyPerWeek: 0.125,
    });
    expect(metrics.get(idle.userId)).toEqual({
      lastAttendanceOn: null, frequencyPerWeek: 0, attendancesThisMonth: 0, cancellations: 0, noShows: 0,
      rehabCount: 0, recoveryCount: 0, recentFrequency: 0, baselineFrequency: 0, usualFrequencyPerWeek: 0,
    });
    expect(await metricsService.getMonthlyStats(userId, today())).toEqual({ month: businessMonth(today()), attendances: thisMonth, avgPerWeek: 1 });
    expect(await ctx.app.get(AttendanceService).countPresentOn(today())).toBe(1);
    expect(await ctx.app.get(SlotStatsService).countSlotsOn(today())).toBe(1);
  });

  describe('access control', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const routes: ['get' | 'post' | 'patch' | 'put', string][] = [
      ['get', `/api/staff/time-slots?date=2026-10-13`],
      ['get', '/api/staff/time-slots/pending-attendance'],
      ['get', `/api/staff/time-slots/${id}/roster`],
      ['patch', `/api/staff/time-slots/${id}`],
      ['post', `/api/staff/time-slots/${id}/cancel`],
      ['put', `/api/staff/bookings/${id}/attendance`],
      ['post', `/api/staff/bookings/${id}/cancel`],
    ];

    it('answers 403 to clients and 401 without a session', async () => {
      const { agent } = await signUpClient(ctx.app);
      for (const [method, path] of routes) {
        const asClient = await agent[method](path).send({});
        expect([method, path, asClient.status, asClient.body.code]).toEqual([method, path, 403, 'FORBIDDEN']);
        const anon = await request(ctx.app.getHttpServer())[method](path).send({});
        expect([method, path, anon.status, anon.body.code]).toEqual([method, path, 401, 'UNAUTHENTICATED']);
      }
    });
  });
});
