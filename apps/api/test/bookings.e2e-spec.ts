import request from 'supertest';
import { addDays, businessDateTime, businessTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { BookingsService } from '../src/modules/bookings/services/bookings.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot, givePack, givePerformancePlan } from './utils/fixtures.js';

describe('bookings (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const tomorrow = () => addDays(businessToday(), 1);

  it('requires a plan covering the slot date for Performance', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 14 });
    await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(403).expect((r) => expect(r.body.code).toBe('PLAN_REQUIRED'));
    await givePerformancePlan(ctx.dataSource, userId, { startsOn: businessToday(), endsOn: tomorrow() });
    const res = await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
    expect(res.body).toMatchObject({ status: 'confirmed', source: 'plan', label: 'Entrenamiento semi personalizado', canCancel: true });
    await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect((r) => expect(r.body.code).toBe('ALREADY_BOOKED'));
    const [log] = await ctx.dataSource.query(`SELECT template FROM email_logs WHERE idempotency_key = $1`, [`booking-confirmed:${res.body.id}`]);
    expect(log.template).toBe('booking-confirmed');
  });

  it('evaluates validity on the local date of the slot (end of day)', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const last = addDays(businessToday(), 3);
    await givePerformancePlan(ctx.dataSource, userId, { startsOn: businessToday(), endsOn: last });
    const lateOnLastDay = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(last, '21:00'), capacity: 14 });
    const nextMorning = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(last, 1), '07:00'), capacity: 14 });
    await agent.post('/api/bookings').send({ timeSlotId: lateOnLastDay }).expect(201);
    await agent.post('/api/bookings').send({ timeSlotId: nextMorning }).expect(403);
  });

  it('never oversells the last spot', async () => {
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 14 });
    for (let i = 0; i < 13; i += 1) {
      const { userId } = await signUpClient(ctx.app);
      await ctx.dataSource.query(`INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'plan')`, [userId, slotId]);
    }
    const a = await signUpClient(ctx.app);
    const b = await signUpClient(ctx.app);
    for (const u of [a, b]) await givePerformancePlan(ctx.dataSource, u.userId, { startsOn: businessToday(), endsOn: tomorrow() });
    const results = await Promise.all([
      a.agent.post('/api/bookings').send({ timeSlotId: slotId }),
      b.agent.post('/api/bookings').send({ timeSlotId: slotId }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('SLOT_FULL');
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM bookings WHERE time_slot_id = $1 AND status = 'confirmed'`, [slotId]);
    expect(count).toBe(14);
  });

  it('uses and returns Recovery pack sessions', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '19:30'), capacity: 2 });
    await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect((r) => expect(r.body.code).toBe('PACKAGE_REQUIRED'));
    const packId = await givePack(ctx.dataSource, userId, { startsOn: businessToday(), endsOn: addDays(businessToday(), 29), total: 4 });
    const booking = await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
    expect(booking.body.source).toBe('package');
    await agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(200);
    const [pack] = await ctx.dataSource.query(`SELECT sessions_used FROM subscriptions WHERE id = $1`, [packId]);
    expect(pack.sessions_used).toBe(0);
  });

  it('requires follow-up enablement for Rehab', async () => {
    const { agent, userId } = await signUpClient(ctx.app);
    const pro = await createProfessional(ctx.dataSource);
    const slotId = await createSlot(ctx.dataSource, { service: 'rehab', startsAt: businessDateTime(tomorrow(), '11:00'), capacity: 1, professionalId: pro });
    await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(403);
    await ctx.dataSource.query(`UPDATE users SET rehab_followup_enabled = true WHERE id = $1`, [userId]);
    const res = await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
    expect(res.body.label).toBe('Seguimiento fisioterapéutico · 60 min');
  });

  it('enforces the cancel window and ownership', async () => {
    const owner = await signUpClient(ctx.app);
    const other = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, owner.userId, { startsOn: businessToday(), endsOn: addDays(businessToday(), 30) });
    const soon = await createSlot(ctx.dataSource, { service: 'performance', startsAt: new Date(Date.now() + 60 * 60 * 1000), capacity: 14 });
    const booking = await owner.agent.post('/api/bookings').send({ timeSlotId: soon }).expect(201);
    expect(booking.body.canCancel).toBe(false);
    await other.agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(404);
    await owner.agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(409)
      .expect((r) => expect(r.body.code).toBe('CANCEL_WINDOW_CLOSED'));
  });

  it('expires abandoned holds and re-confirms only with room', async () => {
    const service = ctx.app.get(BookingsService);
    const a = await signUpClient(ctx.app);
    const b = await signUpClient(ctx.app);
    const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '18:30'), capacity: 1 });
    const hold = await ctx.dataSource.transaction((m) =>
      service.holdForPayment(m, { userId: a.userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 }));
    await ctx.dataSource.query(`UPDATE bookings SET hold_expires_at = now() - interval '1 minute' WHERE id = $1`, [hold.id]);
    expect(await service.expireHolds(new Date())).toBe(1);
    await givePack(ctx.dataSource, b.userId, { startsOn: businessToday(), endsOn: addDays(businessToday(), 29), total: 4 });
    await b.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
    await expect(ctx.dataSource.transaction((m) => service.confirmPaid(m, hold.id))).rejects.toMatchObject({ code: 'SLOT_FULL' });
  });

  it('lists time slots publicly with counts', async () => {
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '07:00'), capacity: 14 });
    const res = await request(ctx.app.getHttpServer()).get(`/api/schedule/time-slots?service=performance&date=${tomorrow()}`).expect(200);
    expect(res.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({ capacity: 14, booked: 0, available: 14, isFull: false, bookedByMe: false });
  });

  describe('booking rules', () => {
    const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);

    it('answers SLOT_NOT_FOUND, and VALIDATION_FAILED for a malformed id', async () => {
      const { agent } = await signUpClient(ctx.app);
      await agent.post('/api/bookings').send({ timeSlotId: '11111111-1111-4111-8111-111111111111' }).expect(404).expect(expectCode('SLOT_NOT_FOUND'));
      await agent.post('/api/bookings').send({ timeSlotId: 'nope' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
      await agent.post('/api/bookings').send({}).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('answers SLOT_NOT_BOOKABLE for started, cancelled and out-of-window slots', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: addDays(businessToday(), -1), endsOn: addDays(businessToday(), 60) });
      const started = await createSlot(ctx.dataSource, { service: 'performance', startsAt: new Date(Date.now() - 60_000), capacity: 14 });
      const cancelled = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '08:00'), capacity: 14 });
      await ctx.dataSource.query(`UPDATE time_slots SET cancelled_at = now() WHERE id = $1`, [cancelled]);
      const lastDay = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(businessToday(), 14), '21:00'), capacity: 14 });
      const tooFar = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(businessToday(), 15), '07:00'), capacity: 14 });
      for (const id of [started, cancelled, tooFar]) {
        await agent.post('/api/bookings').send({ timeSlotId: id }).expect(409).expect(expectCode('SLOT_NOT_BOOKABLE'));
      }
      await agent.post('/api/bookings').send({ timeSlotId: lastDay }).expect(201);
    });

    it('checks ALREADY_BOOKED before SLOT_FULL and SLOT_FULL before the entitlement', async () => {
      const holder = await signUpClient(ctx.app);
      const noPlan = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, holder.userId, { startsOn: businessToday(), endsOn: tomorrow() });
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '20:00'), capacity: 1 });
      await holder.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      await holder.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect(expectCode('ALREADY_BOOKED'));
      await noPlan.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect(expectCode('SLOT_FULL'));
    });

    it('is for clients only', async () => {
      const staff = await signUpStaff(ctx.app, ctx.dataSource);
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 14 });
      await staff.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(403).expect(expectCode('FORBIDDEN'));
      const anon = request(ctx.app.getHttpServer());
      await anon.post('/api/bookings').send({ timeSlotId: slotId }).expect(401).expect(expectCode('UNAUTHENTICATED'));
      await anon.get('/api/me/bookings').expect(401);
      await anon.post('/api/bookings/11111111-1111-4111-8111-111111111111/cancel').expect(401);
    });
  });

  describe('cancellations', () => {
    const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);

    it('frees the spot when the client cancels in time and keeps the booking for metrics', async () => {
      const a = await signUpClient(ctx.app);
      const b = await signUpClient(ctx.app);
      for (const u of [a, b]) await givePerformancePlan(ctx.dataSource, u.userId, { startsOn: businessToday(), endsOn: tomorrow() });
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 1 });
      const booking = await a.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      await b.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect(expectCode('SLOT_FULL'));

      const cancelled = await a.agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(200);
      expect(cancelled.body).toMatchObject({ id: booking.body.id, status: 'cancelled', canCancel: false });
      expect(cancelled.body.cancelledAt).toEqual(expect.any(String));
      const [row] = await ctx.dataSource.query(`SELECT status, cancelled_by, deleted_at FROM bookings WHERE id = $1`, [booking.body.id]);
      expect(row).toEqual({ status: 'cancelled', cancelled_by: 'client', deleted_at: null });

      await b.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      await a.agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(409).expect(expectCode('BOOKING_NOT_CANCELLABLE'));
    });

    it('does not let the client cancel a paid booking online', async () => {
      const service = ctx.app.get(BookingsService);
      const { agent, userId } = await signUpClient(ctx.app);
      const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '18:30'), capacity: 2 });
      const hold = await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 }));
      await ctx.dataSource.transaction((m) => service.confirmPaid(m, hold.id));
      await agent.post(`/api/bookings/${hold.id}/cancel`).expect(409).expect(expectCode('BOOKING_NOT_CANCELLABLE'));
    });

    it('answers BOOKING_NOT_FOUND for another client booking or an unknown id', async () => {
      const owner = await signUpClient(ctx.app);
      const other = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, owner.userId, { startsOn: businessToday(), endsOn: tomorrow() });
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 14 });
      const booking = await owner.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      await other.agent.post(`/api/bookings/${booking.body.id}/cancel`).expect(404).expect(expectCode('BOOKING_NOT_FOUND'));
      await other.agent.post('/api/bookings/11111111-1111-4111-8111-111111111111/cancel').expect(404).expect(expectCode('BOOKING_NOT_FOUND'));
      await other.agent.post('/api/bookings/not-a-uuid/cancel').expect(400).expect(expectCode('VALIDATION_FAILED'));
      const [row] = await ctx.dataSource.query(`SELECT status FROM bookings WHERE id = $1`, [booking.body.id]);
      expect(row.status).toBe('confirmed');
    });
  });

  describe('holds for payment', () => {
    it('holds a spot, confirms it once paid and is idempotent', async () => {
      const service = ctx.app.get(BookingsService);
      const { userId } = await signUpClient(ctx.app);
      const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '17:00'), capacity: 1 });
      const hold = await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 }));
      expect(hold).toMatchObject({ status: 'pending_payment', source: 'payment', subscriptionId: null, service: 'recovery' });
      expect(hold.holdExpiresAt!.getTime() - Date.now()).toBeGreaterThan(14 * 60_000);

      const confirmed = await ctx.dataSource.transaction((m) => service.confirmPaid(m, hold.id));
      expect(confirmed.status).toBe('confirmed');
      const again = await ctx.dataSource.transaction((m) => service.confirmPaid(m, hold.id));
      expect(again.status).toBe('confirmed');
    });

    it('rejects a slot of another service and a full slot', async () => {
      const service = ctx.app.get(BookingsService);
      const a = await signUpClient(ctx.app);
      const b = await signUpClient(ctx.app);
      const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '17:00'), capacity: 1 });
      await expect(ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId: a.userId, timeSlotId: slotId, expectedService: 'rehab', holdMinutes: 15 })))
        .rejects.toMatchObject({ code: 'SERVICE_MISMATCH' });
      await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId: a.userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 }));
      await expect(ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId: b.userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 })))
        .rejects.toMatchObject({ code: 'SLOT_FULL' });
    });

    it('re-confirms an expired hold when there is room and releases holds on demand', async () => {
      const service = ctx.app.get(BookingsService);
      const { userId } = await signUpClient(ctx.app);
      const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '17:00'), capacity: 1 });
      const hold = await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId, timeSlotId: slotId, expectedService: 'recovery', holdMinutes: 15 }));
      expect(await service.expireHolds(new Date(Date.now() + 16 * 60_000))).toBe(1);
      expect(await service.expireHolds(new Date(Date.now() + 16 * 60_000))).toBe(0);
      const [expired] = await ctx.dataSource.query(`SELECT status, cancelled_by FROM bookings WHERE id = $1`, [hold.id]);
      expect(expired).toEqual({ status: 'expired', cancelled_by: 'system' });
      const confirmed = await ctx.dataSource.transaction((m) => service.confirmPaid(m, hold.id));
      expect(confirmed.status).toBe('confirmed');

      const other = await signUpClient(ctx.app);
      const second = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '18:30'), capacity: 1 });
      const pending = await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId: other.userId, timeSlotId: second, expectedService: 'recovery', holdMinutes: 15 }));
      await ctx.dataSource.transaction((m) => service.releaseHold(m, pending.id, 'cancelled'));
      await ctx.dataSource.transaction((m) => service.releaseHold(m, confirmed.id, 'cancelled'));
      const rows: { id: string; status: string }[] = await ctx.dataSource.query(
        `SELECT id, status FROM bookings WHERE id = ANY($1::uuid[])`, [[pending.id, confirmed.id]]);
      expect(Object.fromEntries(rows.map((r) => [r.id, r.status]))).toEqual({ [pending.id]: 'cancelled', [confirmed.id]: 'confirmed' });
    });
  });

  describe('listings', () => {
    it('lists my upcoming and past bookings', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: businessToday(), endsOn: addDays(businessToday(), 10) });
      const later = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(businessToday(), 2), '19:00'), capacity: 14 });
      const sooner = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 14 });
      const toCancel = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '20:00'), capacity: 14 });
      const pendingSlot = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(tomorrow(), '17:00'), capacity: 2 });
      const past = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(addDays(businessToday(), -2), '19:00'), capacity: 14 });
      await ctx.dataSource.query(`INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'plan')`, [userId, past]);
      await agent.post('/api/bookings').send({ timeSlotId: later }).expect(201);
      await agent.post('/api/bookings').send({ timeSlotId: sooner }).expect(201);
      const cancelled = await agent.post('/api/bookings').send({ timeSlotId: toCancel }).expect(201);
      await agent.post(`/api/bookings/${cancelled.body.id}/cancel`).expect(200);
      const service = ctx.app.get(BookingsService);
      await ctx.dataSource.transaction((m) =>
        service.holdForPayment(m, { userId, timeSlotId: pendingSlot, expectedService: 'recovery', holdMinutes: 15 }));

      const upcoming = await agent.get('/api/me/bookings').expect(200);
      expect(upcoming.body.map((b: { timeSlotId: string; status: string }) => [b.timeSlotId, b.status])).toEqual([
        [pendingSlot, 'pending_payment'],
        [sooner, 'confirmed'],
        [later, 'confirmed'],
      ]);
      expect(upcoming.body[1]).toMatchObject({
        service: 'performance', durationMinutes: 60, label: 'Entrenamiento semi personalizado', source: 'plan',
        attendance: null, canCancel: true, cancelledAt: null, startsAt: businessDateTime(tomorrow(), '19:00').toISOString(),
      });

      const history = await agent.get('/api/me/bookings?scope=past').expect(200);
      expect(history.body.map((b: { timeSlotId: string; status: string }) => [b.timeSlotId, b.status])).toEqual([
        [toCancel, 'cancelled'],
        [past, 'confirmed'],
      ]);
      await agent.get('/api/me/bookings?scope=nope').expect(400);
    });

    it('counts only active bookings and marks bookedByMe with a session', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const other = await signUpClient(ctx.app);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: businessToday(), endsOn: tomorrow() });
      const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt: businessDateTime(tomorrow(), '19:00'), capacity: 3 });
      await ctx.dataSource.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'cancelled', 'plan'), ($1, $2, 'expired', 'payment')`,
        [other.userId, slotId],
      );
      await agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      const mine = await agent.get(`/api/schedule/time-slots?service=performance&date=${tomorrow()}`).expect(200);
      expect(mine.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({ booked: 1, available: 2, isFull: false, bookedByMe: true });
      const theirs = await other.agent.get(`/api/schedule/time-slots?service=performance&date=${tomorrow()}`).expect(200);
      expect(theirs.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({ booked: 1, bookedByMe: false });
      const anon = request(ctx.app.getHttpServer());
      await anon.get(`/api/schedule/time-slots?service=performance&date=${tomorrow()}`).expect(200);
      await anon.get('/api/schedule/time-slots?service=performance&date=2026-13-40').expect(400);
      await anon.get(`/api/schedule/time-slots?service=gym&date=${tomorrow()}`).expect(400);
      await anon.get('/api/schedule/time-slots?service=performance').expect(400);
    });

    it('lists the activity of a client with labels', async () => {
      const service = ctx.app.get(BookingsService);
      const { agent, userId } = await signUpClient(ctx.app);
      const staff = await signUpStaff(ctx.app, ctx.dataSource);
      await givePerformancePlan(ctx.dataSource, userId, { startsOn: addDays(businessToday(), -5), endsOn: addDays(businessToday(), 10) });
      const pastStart = businessDateTime(addDays(businessToday(), -2), '19:00');
      const past = await createSlot(ctx.dataSource, { service: 'performance', startsAt: pastStart, capacity: 14 });
      const [attended] = await ctx.dataSource.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'plan') RETURNING id`, [userId, past]);
      await staff.agent.put(`/api/staff/bookings/${attended.id}/attendance`).send({ status: 'present' }).expect(200);
      const missedStart = businessDateTime(addDays(businessToday(), -3), '08:00');
      const missedSlot = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: missedStart, capacity: 2 });
      const [missed] = await ctx.dataSource.query(
        `INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'package') RETURNING id`, [userId, missedSlot]);
      await staff.agent.put(`/api/staff/bookings/${missed.id}/attendance`).send({ status: 'no_show' }).expect(200);
      const cancelStart = businessDateTime(tomorrow(), '07:00');
      const cancelSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: cancelStart, capacity: 14 });
      const toCancel = await agent.post('/api/bookings').send({ timeSlotId: cancelSlot }).expect(201);
      await agent.post(`/api/bookings/${toCancel.body.id}/cancel`).expect(200);
      const futureStart = businessDateTime(addDays(businessToday(), 2), '20:00');
      const future = await createSlot(ctx.dataSource, { service: 'performance', startsAt: futureStart, capacity: 14 });
      await agent.post('/api/bookings').send({ timeSlotId: future }).expect(201);

      const items = await service.listActivityForUser(userId);
      expect(items).toEqual([
        { type: 'booking', label: `Reserva — Performance ${businessTime(futureStart)}`, date: futureStart.toISOString(), amount: null, service: 'performance' },
        { type: 'cancellation', label: `Reserva cancelada — Performance ${businessTime(cancelStart)}`, date: cancelStart.toISOString(), amount: null, service: 'performance' },
        { type: 'attendance', label: `Asistencia — Performance ${businessTime(pastStart)}`, date: pastStart.toISOString(), amount: null, service: 'performance' },
        { type: 'attendance', label: `No show — Recovery ${businessTime(missedStart)}`, date: missedStart.toISOString(), amount: null, service: 'recovery' },
      ]);
    });
  });
});
