import { createHmac } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource, type EntityManager } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import type { ProviderPayment } from '../src/modules/payments/models/provider-payment.model.js';
import { MercadoPagoService } from '../src/modules/payments/services/mercado-pago.service.js';
import { PaymentsService } from '../src/modules/payments/services/payments.service.js';
import { SubscriptionsService } from '../src/modules/subscriptions/services/subscriptions.service.js';
import { raisedCheckoutLimit } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot, planIdBySlug } from './utils/fixtures.js';

describe('Mercado Pago webhook (e2e)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  const providerPayments = new Map<string, ProviderPayment>();
  const fake = {
    createPreference: vi.fn(async () => ({ id: 'pref-1', initPoint: 'https://mp.test/init' })),
    getPayment: vi.fn(async (id: string) => providerPayments.get(id)!),
    searchByExternalReference: vi.fn(async (ref: string) => [...providerPayments.values()].filter((p) => p.externalReference === ref)),
  };

  beforeAll(async () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-token';
    process.env.MP_WEBHOOK_SECRET = 'test-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MercadoPagoService).useValue(fake)
      .overrideProvider(getOptionsToken()).useValue(raisedCheckoutLimit)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    ds = app.get(DataSource);
  });
  afterAll(async () => { await app.close(); delete process.env.MP_ACCESS_TOKEN; delete process.env.MP_WEBHOOK_SECRET; });
  beforeEach(async () => { await resetDb(ds); await seedCatalogAndSchedule(ds); providerPayments.clear(); vi.clearAllMocks(); });

  const notify = (paymentId: string, secret = 'test-secret') => {
    const ts = String(Date.now());
    const v1 = createHmac('sha256', secret).update(`id:${paymentId};request-id:req-${paymentId};ts:${ts};`).digest('hex');
    return request(app.getHttpServer())
      .post(`/api/payments/webhook/mercadopago?data.id=${paymentId}&type=payment`)
      .set('x-signature', `ts=${ts},v1=${v1}`).set('x-request-id', `req-${paymentId}`)
      .send({ type: 'payment', data: { id: paymentId }, action: 'payment.updated' });
  };

  const buyQuarterly = async () => {
    const { agent } = await signUpClient(app);
    const planId = await planIdBySlug(ds, 'performance-trimestral');
    const res = await agent.post('/api/checkout/plan').send({ planId }).expect(201);
    return { agent, ref: res.body.externalReference as string };
  };

  const approved = (id: string, ref: string, amount: number): ProviderPayment =>
    ({ id, status: 'approved', statusDetail: 'accredited', externalReference: ref, transactionAmount: amount });

  const count = async (sql: string, params: unknown[] = []): Promise<number> => {
    const [row] = await ds.query(`SELECT count(*)::int AS count FROM ${sql}`, params);
    return row.count as number;
  };

  const purchaseOf = async (ref: string) => {
    const [purchase] = await ds.query(`SELECT status, needs_attention FROM purchases WHERE external_reference = $1`, [ref]);
    return purchase as { status: string; needs_attention: boolean };
  };

  const rehabCheckout = async (agent: Awaited<ReturnType<typeof signUpClient>>['agent']) => {
    const professionalId = await createProfessional(ds);
    const startsAt = businessDateTime(addDays(businessToday(), 1), '10:00');
    const slotId = await createSlot(ds, { service: 'rehab', startsAt, capacity: 1, professionalId });
    const planId = await planIdBySlug(ds, 'rehab-evaluacion');
    const res = await agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
    return { slotId, planId, ref: res.body.externalReference as string, bookingId: res.body.bookingId as string };
  };

  it('rejects forged notifications', async () => {
    await buyQuarterly();
    await notify('111', 'wrong-secret').expect(401).expect((r) => expect(r.body.code).toBe('INVALID_SIGNATURE'));
    expect(fake.getPayment).not.toHaveBeenCalled();
  });

  it('rejects notifications without a signature and leaves the database untouched', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('112', approved('112', ref, 10500));
    await request(app.getHttpServer())
      .post('/api/payments/webhook/mercadopago?data.id=112&type=payment')
      .send({ type: 'payment', data: { id: '112' } })
      .expect(401)
      .expect((r) => expect(r.body.code).toBe('INVALID_SIGNATURE'));
    expect(fake.getPayment).not.toHaveBeenCalled();
    expect(await count('payments')).toBe(0);
    expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
  });

  it('acknowledges other notification types without reading a payment', async () => {
    const ts = String(Date.now());
    const v1 = createHmac('sha256', 'test-secret').update(`id:777;request-id:req-777;ts:${ts};`).digest('hex');
    await request(app.getHttpServer())
      .post('/api/payments/webhook/mercadopago?data.id=777&type=merchant_order')
      .set('x-signature', `ts=${ts},v1=${v1}`).set('x-request-id', 'req-777')
      .send({})
      .expect(200, { received: true });
    expect(fake.getPayment).not.toHaveBeenCalled();
  });

  it('acknowledges payments of unknown purchases without effects', async () => {
    providerPayments.set('444', approved('444', '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', 100));
    await notify('444').expect(200, { received: true });
    expect(await count('payments')).toBe(0);
  });

  it('activates exactly once for duplicated notifications and reconciliation', async () => {
    const { agent, ref } = await buyQuarterly();
    providerPayments.set('222', { id: '222', status: 'approved', statusDetail: 'accredited', externalReference: ref, transactionAmount: 10500 });
    await notify('222').expect(200);
    await notify('222').expect(200);
    await app.get(PaymentsService).reconcilePending(new Date(Date.now() + 60 * 60 * 1000));
    const [{ count: subscriptions }] = await ds.query(`SELECT count(*)::int AS count FROM subscriptions`);
    expect(subscriptions).toBe(1);
    const subs = await agent.get('/api/me/subscriptions').expect(200);
    expect(subs.body.performance.startsOn).toBe(businessToday());
    const [{ count: emails }] = await ds.query(`SELECT count(*)::int AS count FROM email_logs WHERE template = 'purchase-approved'`);
    expect(emails).toBe(1);
    expect(fake.getPayment).toHaveBeenCalledWith('222');
  });

  // Barrier: a separate connection holds the purchase row, so both notifications are in flight before either applies.
  const notifyBehindPurchaseLock = async (ref: string, paymentIds: [string, string]): Promise<request.Response[]> => {
    const gate = ds.createQueryRunner();
    await gate.connect();
    await gate.startTransaction();
    let pending: Promise<request.Response[]> | undefined;
    try {
      await gate.query(`SELECT id FROM purchases WHERE external_reference = $1 FOR UPDATE`, [ref]);
      pending = Promise.all(paymentIds.map((id) => notify(id)));
      const deadline = Date.now() + 10_000;
      while ((await count(`pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`)) < 2) {
        if (Date.now() > deadline) throw new Error('expected 2 backends waiting on the purchase lock');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } finally {
      await gate.commitTransaction();
      await gate.release();
    }
    if (!pending) throw new Error('notifications were not sent');
    return pending;
  };

  it('activates exactly once when the same payment is notified concurrently', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('225', approved('225', ref, 10500));
    const results = await notifyBehindPurchaseLock(ref, ['225', '225']);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await count('subscriptions')).toBe(1);
    expect(await count(`payments WHERE mp_payment_id = '225'`)).toBe(1);
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
  });

  it('activates once and flags the purchase when two different approved payments arrive concurrently', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('228', approved('228', ref, 10500));
    providerPayments.set('229', approved('229', ref, 10500));
    const results = await notifyBehindPurchaseLock(ref, ['228', '229']);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(await count('subscriptions')).toBe(1);
    expect(await count(`payments WHERE applied_at IS NOT NULL`)).toBe(1);
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: true });
  });

  it('does not extend the validity twice for a second approved payment of the same purchase', async () => {
    const { agent, ref } = await buyQuarterly();
    providerPayments.set('226', approved('226', ref, 10500));
    await notify('226').expect(200);
    const before = await agent.get('/api/me/subscriptions').expect(200);
    providerPayments.set('227', approved('227', ref, 10500));
    await notify('227').expect(200);
    const after = await agent.get('/api/me/subscriptions').expect(200);
    expect(after.body.performance.endsOn).toBe(before.body.performance.endsOn);
    expect(await count('subscriptions')).toBe(1);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: true });
  });

  it('applies nothing and flags the purchase when it was approved after it was read (guarded UPDATE, R16 step 3)', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('230', approved('230', ref, 10500));
    await notify('230').expect(200);
    const approvedAt = async (): Promise<Date> =>
      (await ds.query(`SELECT approved_at FROM purchases WHERE external_reference = $1`, [ref]))[0].approved_at;
    const firstApprovedAt = await approvedAt();

    // Simulates a purchase read outside the lock: the second payment still sees it pending.
    const service = app.get(PaymentsService) as unknown as {
      lockPurchase: (manager: EntityManager, ref: string) => Promise<{ status: string } | null>;
    };
    const lockPurchase = service.lockPurchase.bind(service);
    const stale = vi.spyOn(service, 'lockPurchase').mockImplementationOnce(async (manager, reference) => {
      const purchase = await lockPurchase(manager, reference);
      return purchase && { ...purchase, status: 'pending' };
    });
    providerPayments.set('231', approved('231', ref, 10500));
    await notify('231').expect(200);
    expect(stale).toHaveBeenCalledOnce();
    stale.mockRestore();

    const [second] = await ds.query(`SELECT status, applied_at FROM payments WHERE mp_payment_id = '231'`);
    expect(second).toEqual({ status: 'approved', applied_at: null });
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: true });
    expect(await approvedAt()).toEqual(firstApprovedAt);
    expect(await count(`payments WHERE applied_at IS NOT NULL`)).toBe(1);
    expect(await count('subscriptions')).toBe(1);
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
  });

  it('flags amount mismatches without activating', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('333', { id: '333', status: 'approved', statusDetail: 'accredited', externalReference: ref, transactionAmount: 1 });
    await notify('333').expect(200);
    const [purchase] = await ds.query(`SELECT status, needs_attention FROM purchases WHERE external_reference = $1`, [ref]);
    expect(purchase).toEqual({ status: 'pending', needs_attention: true });
    const [{ count: subscriptions }] = await ds.query(`SELECT count(*)::int AS count FROM subscriptions`);
    expect(subscriptions).toBe(0);
  });

  it('keeps the purchase pending when the activation fails (same transaction)', async () => {
    const { ref } = await buyQuarterly();
    providerPayments.set('334', approved('334', ref, 10500));
    const activate = vi.spyOn(app.get(SubscriptionsService), 'activateFromPurchase').mockRejectedValueOnce(new Error('boom'));
    await notify('334').expect(500).expect((r) => expect(r.body.code).toBe('INTERNAL_ERROR'));
    expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
    expect(await count('payments')).toBe(0);
    expect(await count('subscriptions')).toBe(0);
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(0);

    // Mercado Pago retries the notification: now it applies.
    await notify('334').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
    expect(await count('subscriptions')).toBe(1);
    activate.mockRestore();
  });

  it('confirms a held booking once and emails it once', async () => {
    const { agent } = await signUpClient(app);
    const { ref, bookingId } = await rehabCheckout(agent);
    providerPayments.set('550', approved('550', ref, 1800));
    await notify('550').expect(200);
    await notify('550').expect(200);
    const [booking] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [bookingId]);
    expect(booking.status).toBe('confirmed');
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
    expect(await count(`email_logs WHERE idempotency_key = $1`, [`booking-confirmed:${bookingId}`])).toBe(1);
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
    const [payment] = await ds.query(`SELECT status, applied_at FROM payments WHERE mp_payment_id = '550'`);
    expect(payment.status).toBe('approved');
    expect(payment.applied_at).not.toBeNull();
  });

  it('approves and flags a payment that arrives after the hold expired and the slot filled up (D23)', async () => {
    const { agent } = await signUpClient(app);
    const { ref, bookingId, slotId } = await rehabCheckout(agent);
    await ds.query(`UPDATE bookings SET status = 'expired', cancelled_by = 'system', cancelled_at = now() WHERE id = $1`, [bookingId]);
    const other = await signUpClient(app);
    await ds.query(`INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'followup')`, [other.userId, slotId]);

    providerPayments.set('660', approved('660', ref, 1800));
    await notify('660').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: true });
    const [booking] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [bookingId]);
    expect(booking.status).toBe('expired');
    expect(await count(`email_logs WHERE template = 'booking-confirmed'`)).toBe(0);
  });

  it('releases the hold when a booking payment is rejected and flags a later approved retry (R16, D44)', async () => {
    const { agent } = await signUpClient(app);
    const { ref, bookingId } = await rehabCheckout(agent);
    providerPayments.set('661', { id: '661', status: 'rejected', statusDetail: 'cc_rejected_other_reason', externalReference: ref, transactionAmount: 1800 });
    await notify('661').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'rejected', needs_attention: false });
    const [booking] = await ds.query(`SELECT status, cancelled_by FROM bookings WHERE id = $1`, [bookingId]);
    expect(booking).toEqual({ status: 'cancelled', cancelled_by: 'system' });

    // A later approved payment of a rejected purchase is never applied silently.
    providerPayments.set('662', approved('662', ref, 1800));
    await notify('662').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'rejected', needs_attention: true });
  });

  it('keeps a plan purchase pending after a declined payment so an approved retry activates it (D44)', async () => {
    const { agent, ref } = await buyQuarterly();
    providerPayments.set('663', { id: '663', status: 'rejected', statusDetail: 'cc_rejected_other_reason', externalReference: ref, transactionAmount: 10500 });
    await notify('663').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
    const [declined] = await ds.query(`SELECT status, applied_at FROM payments WHERE mp_payment_id = '663'`);
    expect(declined).toEqual({ status: 'rejected', applied_at: null });
    providerPayments.set('664', { id: '664', status: 'cancelled', statusDetail: 'expired', externalReference: ref, transactionAmount: 10500 });
    await notify('664').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
    expect(await count('subscriptions')).toBe(0);

    // The buyer retries with another card on the same preference.
    providerPayments.set('665', approved('665', ref, 10500));
    await notify('665').expect(200);
    expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
    const subs = await agent.get('/api/me/subscriptions').expect(200);
    expect(subs.body.performance).toMatchObject({ planName: 'Plan Trimestral', startsOn: businessToday() });
    expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
  });

  it('cancels the purchase and frees the hold when Mercado Pago fails', async () => {
    const { agent } = await signUpClient(app);
    const professionalId = await createProfessional(ds);
    const slotId = await createSlot(ds, { service: 'rehab', startsAt: businessDateTime(addDays(businessToday(), 1), '11:00'), capacity: 1, professionalId });
    const planId = await planIdBySlug(ds, 'rehab-evaluacion');
    fake.createPreference.mockRejectedValueOnce(new Error('provider down'));
    await agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(502)
      .expect((r) => expect(r.body.code).toBe('PAYMENT_PROVIDER_ERROR'));
    const [purchase] = await ds.query(`SELECT status FROM purchases`);
    expect(purchase.status).toBe('cancelled');
    expect(await count(`bookings WHERE status IN ('pending_payment','confirmed')`)).toBe(0);
    await agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
  });

  it('stores the preference and sends the hold expiry to Mercado Pago', async () => {
    const { agent } = await signUpClient(app);
    const { ref } = await rehabCheckout(agent);
    const [purchase] = await ds.query(`SELECT mp_preference_id FROM purchases WHERE external_reference = $1`, [ref]);
    expect(purchase.mp_preference_id).toBe('pref-1');
    const [input] = fake.createPreference.mock.calls.at(-1) as unknown as [{ externalReference: string; unitPrice: number; expiresAt: Date }];
    expect(input).toMatchObject({ externalReference: ref, unitPrice: 1800 });
    expect(input.expiresAt).toBeInstanceOf(Date);
  });

  describe('reconciliation', () => {
    const backdate = (ref: string, interval: string) =>
      ds.query(`UPDATE purchases SET created_at = now() - $2::interval WHERE external_reference = $1`, [ref, interval]);

    it('applies payments whose webhook never arrived, approved first', async () => {
      const { agent, ref } = await buyQuarterly();
      await backdate(ref, '30 minutes');
      providerPayments.set('801', { id: '801', status: 'rejected', statusDetail: 'cc_rejected_other_reason', externalReference: ref, transactionAmount: 10500 });
      providerPayments.set('802', approved('802', ref, 10500));
      const result = await app.get(PaymentsService).reconcilePending(new Date());
      expect(result).toEqual({ applied: 1, expired: 0 });
      expect(fake.searchByExternalReference).toHaveBeenCalledWith(ref);
      expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).not.toBeNull();
    });

    it('leaves recent purchases for the webhook', async () => {
      const { ref } = await buyQuarterly();
      providerPayments.set('803', approved('803', ref, 10500));
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(fake.searchByExternalReference).not.toHaveBeenCalled();
      expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
    });

    it('expires plan purchases pending for more than 24 hours and booking purchases whose hold expired', async () => {
      const plan = await buyQuarterly();
      await backdate(plan.ref, '25 hours');
      const recentPlan = await buyQuarterly();
      await backdate(recentPlan.ref, '23 hours');
      const { agent } = await signUpClient(app);
      const booking = await rehabCheckout(agent);
      await ds.query(`UPDATE bookings SET status = 'expired', cancelled_by = 'system', cancelled_at = now() WHERE id = $1`, [booking.bookingId]);

      const result = await app.get(PaymentsService).reconcilePending(new Date());
      expect(result).toEqual({ applied: 0, expired: 2 });
      expect((await purchaseOf(plan.ref)).status).toBe('expired');
      expect((await purchaseOf(recentPlan.ref)).status).toBe('pending');
      expect((await purchaseOf(booking.ref)).status).toBe('expired');

      // An approved payment that shows up later still activates an expired purchase.
      providerPayments.set('804', approved('804', plan.ref, 10500));
      await notify('804').expect(200);
      expect((await purchaseOf(plan.ref)).status).toBe('approved');
    });

    it('expires the purchase of a hold cancelled by staff and flags a later approved payment (D23)', async () => {
      const { agent } = await signUpClient(app);
      const booking = await rehabCheckout(agent);
      const staff = await signUpStaff(app, ds);
      await staff.agent.post(`/api/staff/bookings/${booking.bookingId}/cancel`).expect(200);

      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect(await purchaseOf(booking.ref)).toEqual({ status: 'expired', needs_attention: false });

      providerPayments.set('809', approved('809', booking.ref, 1800));
      await notify('809').expect(200);
      expect(await purchaseOf(booking.ref)).toEqual({ status: 'approved', needs_attention: true });
      const [row] = await ds.query(`SELECT status, cancelled_by FROM bookings WHERE id = $1`, [booking.bookingId]);
      expect(row).toEqual({ status: 'cancelled', cancelled_by: 'staff' });
      expect(await count(`email_logs WHERE template = 'booking-confirmed'`)).toBe(0);
    });

    it('expires the purchase of a hold cancelled by the system', async () => {
      const { agent } = await signUpClient(app);
      const booking = await rehabCheckout(agent);
      await ds.query(`UPDATE bookings SET status = 'cancelled', cancelled_by = 'system', cancelled_at = now() WHERE id = $1`, [booking.bookingId]);
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect((await purchaseOf(booking.ref)).status).toBe('expired');
    });

    it('records a late approval of a staff-cancelled hold found only by reconciliation and flags it (D23, D60)', async () => {
      const { agent } = await signUpClient(app);
      const booking = await rehabCheckout(agent);
      const staff = await signUpStaff(app, ds);
      await staff.agent.post(`/api/staff/bookings/${booking.bookingId}/cancel`).expect(200);
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect(await purchaseOf(booking.ref)).toEqual({ status: 'expired', needs_attention: false });

      // The client pays anyway and the webhook is lost: only Mercado Pago's search knows about it.
      providerPayments.set('810', approved('810', booking.ref, 1800));
      fake.searchByExternalReference.mockClear();
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      expect(fake.searchByExternalReference.mock.calls).toEqual([[booking.ref]]);
      expect(fake.getPayment).not.toHaveBeenCalled();
      expect(await purchaseOf(booking.ref)).toEqual({ status: 'approved', needs_attention: true });
      const [payment] = await ds.query(`SELECT status, applied_at FROM payments WHERE mp_payment_id = '810'`);
      expect(payment.status).toBe('approved');
      expect(payment.applied_at).not.toBeNull();
      const [row] = await ds.query(`SELECT status, cancelled_by FROM bookings WHERE id = $1`, [booking.bookingId]);
      expect(row).toEqual({ status: 'cancelled', cancelled_by: 'staff' });
      expect(await count(`email_logs WHERE template = 'booking-confirmed'`)).toBe(0);
    });

    it('rechecks expired purchases from the last 7 days and applies a late approval (D45, D60)', async () => {
      const { agent, ref } = await buyQuarterly();
      await backdate(ref, '25 hours');
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect((await purchaseOf(ref)).status).toBe('expired');

      const old = await buyQuarterly();
      await backdate(old.ref, '8 days');
      await ds.query(`UPDATE purchases SET status = 'expired' WHERE external_reference = $1`, [old.ref]);
      const booking = await rehabCheckout((await signUpClient(app)).agent);
      await backdate(booking.ref, '1 hour');
      await ds.query(`UPDATE purchases SET status = 'expired' WHERE external_reference = $1`, [booking.ref]);
      providerPayments.set('806', approved('806', ref, 10500));
      providerPayments.set('807', approved('807', old.ref, 10500));
      providerPayments.set('808', approved('808', booking.ref, 1800));
      fake.searchByExternalReference.mockClear();

      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 2, expired: 0 });
      expect(fake.searchByExternalReference.mock.calls).toEqual([[ref], [booking.ref]]);
      expect(await purchaseOf(ref)).toEqual({ status: 'approved', needs_attention: false });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ planName: 'Plan Trimestral' });
      expect((await purchaseOf(old.ref)).status).toBe('expired');
      // The booking purchase expired while its hold was still live: the late approval confirms the booking.
      expect(await purchaseOf(booking.ref)).toEqual({ status: 'approved', needs_attention: false });
      const [held] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [booking.bookingId]);
      expect(held.status).toBe('confirmed');

      // Idempotent: a further run finds nothing left to apply.
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(await count('subscriptions')).toBe(1);
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(2);
      expect(await count(`email_logs WHERE idempotency_key = $1`, [`booking-confirmed:${booking.bookingId}`])).toBe(1);
    });

    it('keeps going when Mercado Pago fails for one purchase', async () => {
      const first = await buyQuarterly();
      const second = await buyQuarterly();
      await backdate(first.ref, '30 minutes');
      await backdate(second.ref, '31 minutes');
      providerPayments.set('805', approved('805', first.ref, 10500));
      // The oldest purchase (`second`) is reconciled first and its search fails.
      fake.searchByExternalReference.mockRejectedValueOnce(new Error('provider down'));
      const result = await app.get(PaymentsService).reconcilePending(new Date());
      expect(result.applied).toBe(1);
      expect(fake.searchByExternalReference).toHaveBeenCalledTimes(2);
      expect((await purchaseOf(first.ref)).status).toBe('approved');
      expect((await purchaseOf(second.ref)).status).toBe('pending');
    });
  });

  it('hides the development simulator when Mercado Pago is configured', async () => {
    const { ref } = await buyQuarterly();
    await request(app.getHttpServer()).post('/api/payments/dev/simulate').send({ externalReference: ref, outcome: 'approved' })
      .expect(404).expect((r) => expect(r.body.code).toBe('NOT_FOUND'));
    expect(await purchaseOf(ref)).toEqual({ status: 'pending', needs_attention: false });
  });

  it('returns the real Mercado Pago init point', async () => {
    const { agent } = await signUpClient(app);
    const planId = await planIdBySlug(ds, 'performance-mensual');
    const res = await agent.post('/api/checkout/plan').send({ planId }).expect(201);
    expect(res.body).toMatchObject({ initPoint: 'https://mp.test/init', bookingId: null, holdExpiresAt: null });
  });
});
