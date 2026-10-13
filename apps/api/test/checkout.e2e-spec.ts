import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot, planIdBySlug } from './utils/fixtures.js';

// Development simulator active: no MP_ACCESS_TOKEN in the e2e environment.
describe('checkout (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const http = () => request(ctx.app.getHttpServer());
  const expectCode = (code: string) => (r: request.Response) => expect(r.body.code).toBe(code);
  const tomorrowAt = (time: string) => businessDateTime(addDays(businessToday(), 1), time);
  const rehabSlot = async (time = '10:00') =>
    createSlot(ctx.dataSource, { service: 'rehab', startsAt: tomorrowAt(time), capacity: 1, professionalId: await createProfessional(ctx.dataSource) });
  const guest = (email = `guest-${randomUUID()}@test.move`) => ({ name: 'Invitada Test', email, phone: '099123456' });
  const simulate = (externalReference: string, outcome: 'approved' | 'rejected') =>
    http().post('/api/payments/dev/simulate').send({ externalReference, outcome }).expect(200);

  describe('plans', () => {
    it('buys a plan through the simulator', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      const res = await agent.post('/api/checkout/plan').send({ planId }).expect(201);
      expect(res.body).toMatchObject({ bookingId: null, holdExpiresAt: null });
      expect(res.body.initPoint).toContain(`/checkout/simulado?ref=${res.body.externalReference}`);
      expect(typeof res.body.purchaseId).toBe('string');

      const status = await simulate(res.body.externalReference, 'approved');
      expect(status.body).toEqual({
        externalReference: res.body.externalReference, status: 'approved', kind: 'plan', itemName: 'Plan Mensual',
        service: 'performance', amount: 3900, bookingId: null, startsAt: null, needsAttention: false,
      });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ planName: 'Plan Mensual', startsOn: businessToday() });
      const [{ count }] = await ctx.dataSource.query(
        `SELECT count(*)::int AS count FROM email_logs WHERE idempotency_key = $1`, [`purchase-approved:${res.body.purchaseId}`],
      );
      expect(count).toBe(1);

      // Simulating again neither extends the plan nor emails twice.
      await simulate(res.body.externalReference, 'approved');
      const [{ subscriptions }] = await ctx.dataSource.query(`SELECT count(*)::int AS subscriptions FROM subscriptions`);
      expect(subscriptions).toBe(1);
    });

    it('buys a Recovery pack', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-paquete-4');
      const res = await agent.post('/api/checkout/plan').send({ planId }).expect(201);
      await simulate(res.body.externalReference, 'approved');
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.recoveryPacks).toEqual([expect.objectContaining({ sessionsTotal: 4, sessionsLeft: 4 })]);
    });

    it('rejects other plan kinds, unknown and inactive plans', async () => {
      const { agent } = await signUpClient(ctx.app);
      const single = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      await agent.post('/api/checkout/plan').send({ planId: single }).expect(400).expect(expectCode('PLAN_KIND_INVALID'));
      await agent.post('/api/checkout/plan').send({ planId: randomUUID() }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
      const monthly = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await ctx.dataSource.query(`UPDATE plans SET active = false WHERE id = $1`, [monthly]);
      await agent.post('/api/checkout/plan').send({ planId: monthly }).expect(409).expect(expectCode('PLAN_INACTIVE'));
      await agent.post('/api/checkout/plan').send({ planId: 'not-a-uuid' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM purchases`);
      expect(count).toBe(0);
    });

    it('requires a client session', async () => {
      const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await http().post('/api/checkout/plan').send({ planId }).expect(401).expect(expectCode('UNAUTHENTICATED'));
      const staff = await signUpStaff(ctx.app, ctx.dataSource);
      await staff.agent.post('/api/checkout/plan').send({ planId }).expect(403).expect(expectCode('FORBIDDEN'));
    });
  });

  describe('bookings', () => {
    it('lets a guest book and pay a Rehab evaluation', async () => {
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const data = guest();
      const res = await http().post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest: data }).expect(201);
      expect(typeof res.body.bookingId).toBe('string');
      expect(new Date(res.body.holdExpiresAt).getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
      expect(res.body.initPoint).toContain('/checkout/simulado?ref=');

      const [user] = await ctx.dataSource.query(`SELECT id, role, name, phone FROM users WHERE email = $1`, [data.email]);
      expect(user).toMatchObject({ role: 'client', name: 'Invitada Test', phone: '099123456' });
      const [invitation] = await ctx.dataSource.query(`SELECT template FROM email_logs WHERE user_id = $1 AND template = 'account-invitation'`, [user.id]);
      expect(invitation).toBeDefined();
      const [held] = await ctx.dataSource.query(`SELECT status, source, user_id FROM bookings WHERE id = $1`, [res.body.bookingId]);
      expect(held).toEqual({ status: 'pending_payment', source: 'payment', user_id: user.id });

      const status = await simulate(res.body.externalReference, 'approved');
      expect(status.body).toMatchObject({
        status: 'approved', kind: 'booking', itemName: 'Evaluación y Diagnóstico', service: 'rehab', amount: 1800,
        bookingId: res.body.bookingId, startsAt: tomorrowAt('10:00').toISOString(), needsAttention: false,
      });
      const [confirmed] = await ctx.dataSource.query(`SELECT status FROM bookings WHERE id = $1`, [res.body.bookingId]);
      expect(confirmed.status).toBe('confirmed');
      const keys: { idempotency_key: string }[] = await ctx.dataSource.query(
        `SELECT idempotency_key FROM email_logs WHERE template IN ('booking-confirmed','purchase-approved') ORDER BY template`,
      );
      expect(keys.map((k) => k.idempotency_key)).toEqual([`booking-confirmed:${res.body.bookingId}`, `purchase-approved:${res.body.purchaseId}`]);

      await simulate(res.body.externalReference, 'approved');
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM email_logs WHERE template IN ('booking-confirmed','purchase-approved')`);
      expect(count).toBe(2);
    });

    it('asks existing accounts to sign in and requires guest data without a session', async () => {
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const data = guest();
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest: data }).expect(201);

      const other = await rehabSlot('11:00');
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: other, guest: data }).expect(409).expect(expectCode('LOGIN_REQUIRED'));
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: other, guest: { ...data, email: data.email.toUpperCase() } })
        .expect(409).expect(expectCode('LOGIN_REQUIRED'));
      const client = await signUpClient(ctx.app);
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: other, guest: { ...guest(), email: client.email } })
        .expect(409).expect(expectCode('LOGIN_REQUIRED'));
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: other }).expect(400).expect(expectCode('GUEST_DATA_REQUIRED'));
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM purchases`);
      expect(count).toBe(1);
    });

    it('uses the session user and ignores guest data when signed in', async () => {
      const { agent, userId } = await signUpClient(ctx.app);
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const data = guest();
      const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest: data }).expect(201);
      const [booking] = await ctx.dataSource.query(`SELECT user_id FROM bookings WHERE id = $1`, [res.body.bookingId]);
      expect(booking.user_id).toBe(userId);
      const users = await ctx.dataSource.query(`SELECT id FROM users WHERE email = $1`, [data.email]);
      expect(users).toHaveLength(0);
    });

    it('forbids staff sessions from booking (D25)', async () => {
      const staff = await signUpStaff(ctx.app, ctx.dataSource);
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const data = guest();
      await staff.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest: data }).expect(403).expect(expectCode('FORBIDDEN'));
      const [{ bookings }] = await ctx.dataSource.query(`SELECT count(*)::int AS bookings FROM bookings`);
      const [{ purchases }] = await ctx.dataSource.query(`SELECT count(*)::int AS purchases FROM purchases`);
      const [{ users }] = await ctx.dataSource.query(`SELECT count(*)::int AS users FROM users`);
      expect({ bookings, purchases, users }).toEqual({ bookings: 0, purchases: 0, users: 1 });
    });

    it('books a single Recovery session', async () => {
      const { agent } = await signUpClient(ctx.app);
      const slotId = await createSlot(ctx.dataSource, { service: 'recovery', startsAt: tomorrowAt('09:00'), capacity: 2 });
      const planId = await planIdBySlug(ctx.dataSource, 'recovery-sesion');
      const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
      await simulate(res.body.externalReference, 'approved');
      const bookings = await agent.get('/api/me/bookings').expect(200);
      expect(bookings.body).toEqual([expect.objectContaining({ id: res.body.bookingId, status: 'confirmed', label: 'Sesión Recovery · 45 min' })]);
    });

    it('validates the plan kind, the service and the slot', async () => {
      const { agent } = await signUpClient(ctx.app);
      const evaluation = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const performanceSlot = await createSlot(ctx.dataSource, { service: 'performance', startsAt: tomorrowAt('19:00'), capacity: 14 });
      await agent.post('/api/checkout/booking').send({ planId: evaluation, timeSlotId: performanceSlot }).expect(400).expect(expectCode('SERVICE_MISMATCH'));
      const monthly = await planIdBySlug(ctx.dataSource, 'performance-mensual');
      await agent.post('/api/checkout/booking').send({ planId: monthly, timeSlotId: performanceSlot }).expect(400).expect(expectCode('PLAN_KIND_INVALID'));
      await agent.post('/api/checkout/booking').send({ planId: evaluation, timeSlotId: randomUUID() }).expect(404).expect(expectCode('SLOT_NOT_FOUND'));
      await agent.post('/api/checkout/booking').send({ planId: randomUUID(), timeSlotId: performanceSlot }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
      await ctx.dataSource.query(`UPDATE plans SET active = false WHERE id = $1`, [evaluation]);
      await agent.post('/api/checkout/booking').send({ planId: evaluation, timeSlotId: performanceSlot }).expect(409).expect(expectCode('PLAN_INACTIVE'));
    });

    it('rejects full, past and duplicate slots before creating a guest account', async () => {
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const full = await rehabSlot();
      const holder = await signUpClient(ctx.app);
      await holder.agent.post('/api/checkout/booking').send({ planId, timeSlotId: full }).expect(201);
      await holder.agent.post('/api/checkout/booking').send({ planId, timeSlotId: full }).expect(409).expect(expectCode('ALREADY_BOOKED'));

      const data = guest();
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: full, guest: data }).expect(409).expect(expectCode('SLOT_FULL'));
      const past = await createSlot(ctx.dataSource, {
        service: 'rehab', startsAt: new Date(Date.now() - 60 * 60_000), capacity: 1, professionalId: await createProfessional(ctx.dataSource),
      });
      await http().post('/api/checkout/booking').send({ planId, timeSlotId: past, guest: data }).expect(409).expect(expectCode('SLOT_NOT_BOOKABLE'));
      const users = await ctx.dataSource.query(`SELECT id FROM users WHERE email = $1`, [data.email]);
      expect(users).toHaveLength(0);
    });

    it('releases the hold when the payment is rejected', async () => {
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const first = await signUpClient(ctx.app);
      const res = await first.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
      const second = await signUpClient(ctx.app);
      await second.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(409).expect(expectCode('SLOT_FULL'));

      const status = await simulate(res.body.externalReference, 'rejected');
      expect(status.body.status).toBe('rejected');
      const [booking] = await ctx.dataSource.query(`SELECT status FROM bookings WHERE id = $1`, [res.body.bookingId]);
      expect(booking.status).toBe('cancelled');
      await second.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
    });

    it('validates guest data', async () => {
      const slotId = await rehabSlot();
      const planId = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
      const send = (g: Record<string, unknown>) =>
        http().post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest: g }).expect(400).expect(expectCode('VALIDATION_FAILED'));
      await send({ ...guest(), name: '   ' });
      await send({ ...guest(), name: 'Ana\u0000' });
      await send({ ...guest(), email: 'not-an-email' });
      await send({ ...guest(), phone: '123' });
      await send({ name: 'Ana Test', email: `g-${randomUUID()}@test.move` });
      await send({ ...guest(), extra: true });
      const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM users`);
      expect(count).toBe(0);
    });
  });

  describe('purchase status', () => {
    it('is public and answers PURCHASE_NOT_FOUND for unknown references', async () => {
      const { agent } = await signUpClient(ctx.app);
      const planId = await planIdBySlug(ctx.dataSource, 'performance-trimestral');
      const res = await agent.post('/api/checkout/plan').send({ planId }).expect(201);
      const status = await http().get(`/api/checkout/purchases/${res.body.externalReference}`).expect(200);
      expect(status.body).toEqual({
        externalReference: res.body.externalReference, status: 'pending', kind: 'plan', itemName: 'Plan Trimestral',
        service: 'performance', amount: 10500, bookingId: null, startsAt: null, needsAttention: false,
      });
      await http().get(`/api/checkout/purchases/${randomUUID()}`).expect(404).expect(expectCode('PURCHASE_NOT_FOUND'));
      await http().get('/api/checkout/purchases/not-a-uuid').expect(404).expect(expectCode('PURCHASE_NOT_FOUND'));
    });
  });

  describe('development simulator', () => {
    it('validates its input', async () => {
      await http().post('/api/payments/dev/simulate').send({ externalReference: randomUUID(), outcome: 'approved' })
        .expect(404).expect(expectCode('PURCHASE_NOT_FOUND'));
      await http().post('/api/payments/dev/simulate').send({ externalReference: randomUUID(), outcome: 'refunded' })
        .expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });
});
