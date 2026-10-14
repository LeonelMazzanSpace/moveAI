import { createHmac } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDays, addMonths, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import type { ProviderPayment } from '../src/modules/payments/models/provider-payment.model.js';
import type { ProviderAuthorizedPayment, ProviderPreapproval } from '../src/modules/payments/models/provider-preapproval.model.js';
import { MercadoPagoService } from '../src/modules/payments/services/mercado-pago.service.js';
import { PaymentsService } from '../src/modules/payments/services/payments.service.js';
import { raisedCheckoutLimit } from './utils/app.js';
import { signUpClient, type TestAgent } from './utils/auth.js';
import { resetDb, waitForLockWaiters } from './utils/db.js';
import { givePerformancePlan } from './utils/fixtures.js';

const SECRET = 'test-secret';

describe('automatic debit with Mercado Pago (e2e, fake provider)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  const preapprovals = new Map<string, ProviderPreapproval>();
  const charges = new Map<string, ProviderAuthorizedPayment>();
  const payments = new Map<string, ProviderPayment>();
  let nextPreapproval = 0;
  const fake = {
    createPreference: vi.fn(async () => ({ id: 'pref-1', initPoint: 'https://mp.test/init' })),
    getPayment: vi.fn(async (id: string) => payments.get(id)!),
    searchByExternalReference: vi.fn(async () => []),
    createPreapproval: vi.fn(async (input: { externalReference: string }) => {
      nextPreapproval += 1;
      const id = `pre-${nextPreapproval}`;
      preapprovals.set(id, { id, status: 'pending', externalReference: input.externalReference, nextPaymentDate: null });
      return { id, initPoint: `https://mp.test/sub/${id}` };
    }),
    getPreapproval: vi.fn(async (id: string) => preapprovals.get(id)!),
    cancelPreapproval: vi.fn(async (id: string) => {
      const cancelled: ProviderPreapproval = { ...preapprovals.get(id)!, status: 'cancelled' };
      preapprovals.set(id, cancelled);
      return cancelled;
    }),
    getAuthorizedPayment: vi.fn(async (id: string) => charges.get(id)!),
    searchAuthorizedPayments: vi.fn(async (preapprovalId: string) => [...charges.values()].filter((c) => c.preapprovalId === preapprovalId)),
  };

  beforeAll(async () => {
    process.env.MP_ACCESS_TOKEN = 'TEST-token';
    process.env.MP_WEBHOOK_SECRET = SECRET;
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
  beforeEach(async () => {
    await resetDb(ds);
    await seedCatalogAndSchedule(ds);
    preapprovals.clear();
    charges.clear();
    payments.clear();
    vi.clearAllMocks();
  });

  const today = () => businessToday();

  const notify = (type: string, dataId: string, secret = SECRET) => {
    const ts = String(Date.now());
    const v1 = createHmac('sha256', secret).update(`id:${dataId};request-id:req-${dataId};ts:${ts};`).digest('hex');
    return request(app.getHttpServer())
      .post(`/api/payments/webhook/mercadopago?data.id=${dataId}&type=${type}`)
      .set('x-signature', `ts=${ts},v1=${v1}`).set('x-request-id', `req-${dataId}`)
      .send({ type, data: { id: dataId } });
  };

  const count = async (sql: string, params: unknown[] = []): Promise<number> =>
    (await ds.query(`SELECT count(*)::int AS count FROM ${sql}`, params))[0].count as number;

  const debitRow = async (ref: string) =>
    (await ds.query(
      `SELECT id, status, cancel_reason AS "cancelReason", mp_preapproval_id AS "preapprovalId", next_charge_date AS "nextChargeDate"
       FROM auto_debits WHERE external_reference = $1`,
      [ref],
    ))[0] as { id: string; status: string; cancelReason: string | null; preapprovalId: string | null; nextChargeDate: string | null };

  const startDebit = async (agent?: TestAgent, planSlug = 'performance-mensual') => {
    const client = agent ? { agent } : await signUpClient(app);
    const res = await client.agent.post('/api/checkout/auto-debit').send({ planSlug }).expect(201);
    const ref = res.body.externalReference as string;
    const { preapprovalId } = await debitRow(ref);
    return { agent: client.agent, ref, preapprovalId: preapprovalId!, initPoint: res.body.initPoint as string };
  };

  const authorizeInProvider = (preapprovalId: string, nextPaymentDate: string | null = addMonths(today(), 1)) => {
    preapprovals.set(preapprovalId, { ...preapprovals.get(preapprovalId)!, status: 'authorized', nextPaymentDate });
  };

  const chargeInProvider = (input: { chargeId: string; preapprovalId: string; paymentId: string | null; status?: ProviderPayment['status']; amount?: number }) => {
    charges.set(input.chargeId, { id: input.chargeId, preapprovalId: input.preapprovalId, paymentId: input.paymentId, status: 'processed' });
    if (input.paymentId) {
      payments.set(input.paymentId, {
        id: input.paymentId, status: input.status ?? 'approved', statusDetail: 'accredited', externalReference: '', transactionAmount: input.amount ?? 3900,
      });
    }
  };

  describe('checkout', () => {
    it('creates the Mercado Pago subscription with the client email, the fixed amount and the start date', async () => {
      const { agent, userId, email } = await signUpClient(app);
      const endsOn = addDays(today(), 5);
      await givePerformancePlan(ds, userId, { startsOn: today(), endsOn });
      const { ref, preapprovalId, initPoint } = await startDebit(agent);
      expect(initPoint).toBe(`https://mp.test/sub/${preapprovalId}`);
      expect(fake.createPreapproval).toHaveBeenCalledWith({
        externalReference: ref, reason: 'Plan Mensual', payerEmail: email, frequency: 1, frequencyType: 'months', amount: 3900,
        startDate: addDays(endsOn, 1),
      });
      expect(await debitRow(ref)).toMatchObject({ status: 'pending', preapprovalId: 'pre-1', nextChargeDate: addDays(endsOn, 1) });
    });

    it('closes the debit and answers PAYMENT_PROVIDER_ERROR when Mercado Pago fails', async () => {
      const { agent } = await signUpClient(app);
      fake.createPreapproval.mockRejectedValueOnce(new Error('down'));
      const res = await agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).expect(502);
      expect(res.body.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(await count(`auto_debits WHERE status = 'cancelled' AND cancel_reason = 'provider'`)).toBe(1);
      await startDebit(agent);
    });

    it('cancels the replaced pending subscription in Mercado Pago', async () => {
      const first = await startDebit();
      await startDebit(first.agent);
      expect(fake.cancelPreapproval).toHaveBeenCalledWith(first.preapprovalId);
      expect(await debitRow(first.ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
    });

    // M-1. Barrier: the first checkout waits inside `createPreapproval` while the debit is closed by another request.
    const holdFirstPreapproval = () => {
      let arrived = (): void => undefined;
      let release = (): void => undefined;
      const reached = new Promise<void>((resolve) => { arrived = resolve; });
      const released = new Promise<void>((resolve) => { release = resolve; });
      const create = fake.createPreapproval.getMockImplementation()!;
      fake.createPreapproval.mockImplementationOnce(async (input) => {
        arrived();
        await released;
        return create(input);
      });
      return { reached, release };
    };
    const onlyPending = async (userId: string) =>
      (await ds.query(`SELECT id, external_reference AS ref FROM auto_debits WHERE user_id = $1 AND status = 'pending'`, [userId]))[0] as
        { id: string; ref: string };

    it('does not hand out the link of a debit replaced while Mercado Pago was creating it, and cancels it there (M-1)', async () => {
      const { agent, userId } = await signUpClient(app);
      const gate = holdFirstPreapproval();
      const first = agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).then((res) => res);
      await gate.reached;
      const replaced = await onlyPending(userId);
      const second = await startDebit(agent);
      gate.release();

      const res = await first;
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('AUTO_DEBIT_ACTIVE');
      const a = await debitRow(replaced.ref);
      expect(a).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(fake.cancelPreapproval).toHaveBeenCalledWith(a.preapprovalId);
      expect(preapprovals.get(a.preapprovalId!)!.status).toBe('cancelled');
      expect(await debitRow(second.ref)).toMatchObject({ status: 'pending' });
    });

    it('does not hand out the link of a debit the client cancelled while Mercado Pago was creating it (M-1)', async () => {
      const { agent, userId } = await signUpClient(app);
      const gate = holdFirstPreapproval();
      const first = agent.post('/api/checkout/auto-debit').send({ planSlug: 'performance-mensual' }).then((res) => res);
      await gate.reached;
      const debit = await onlyPending(userId);
      await agent.post(`/api/me/auto-debits/${debit.id}/cancel`).expect(200);
      gate.release();

      const res = await first;
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('AUTO_DEBIT_NOT_FOUND');
      const row = await debitRow(debit.ref);
      expect(row).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(preapprovals.get(row.preapprovalId!)!.status).toBe('cancelled');
    });
  });

  describe('notifications', () => {
    it('rejects forged subscription notifications without reading Mercado Pago', async () => {
      const { ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId, 'wrong').expect(401).expect((r) => expect(r.body.code).toBe('INVALID_SIGNATURE'));
      await notify('subscription_authorized_payment', '9001', 'wrong').expect(401);
      await request(app.getHttpServer()).post(`/api/payments/webhook/mercadopago?data.id=${preapprovalId}&type=subscription_preapproval`).expect(401);
      expect(fake.getPreapproval).not.toHaveBeenCalled();
      expect(fake.getAuthorizedPayment).not.toHaveBeenCalled();
      expect(await debitRow(ref)).toMatchObject({ status: 'pending' });
    });

    it('authorizes the debit with the next charge date Mercado Pago reports', async () => {
      const { ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId, addDays(today(), 3));
      await notify('subscription_preapproval', preapprovalId).expect(200, { received: true });
      expect(fake.getPreapproval).toHaveBeenCalledWith(preapprovalId);
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized', nextChargeDate: addDays(today(), 3) });
    });

    it('treats a subscription paused in Mercado Pago as authorized', async () => {
      const { ref, preapprovalId } = await startDebit();
      preapprovals.set(preapprovalId, { ...preapprovals.get(preapprovalId)!, status: 'paused' });
      await notify('subscription_preapproval', preapprovalId).expect(200);
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
    });

    it('closes the debit when Mercado Pago cancels it and keeps the paid period', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9000', preapprovalId, paymentId: '500' });
      await notify('subscription_authorized_payment', '9000').expect(200);
      preapprovals.set(preapprovalId, { ...preapprovals.get(preapprovalId)!, status: 'cancelled' });
      await notify('subscription_preapproval', preapprovalId).expect(200);
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled', cancelReason: 'provider', nextChargeDate: null });
      await notify('subscription_preapproval', preapprovalId).expect(200);
      expect(await count(`email_logs WHERE template = 'auto-debit-cancelled'`)).toBe(1);
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ endsOn: addMonths(today(), 1) });
    });

    it('acknowledges unknown subscriptions and charges without effects', async () => {
      preapprovals.set('pre-x', { id: 'pre-x', status: 'authorized', externalReference: 'not-ours', nextPaymentDate: null });
      await notify('subscription_preapproval', 'pre-x').expect(200, { received: true });
      charges.set('9100', { id: '9100', preapprovalId: 'pre-x', paymentId: '510', status: 'processed' });
      await notify('subscription_authorized_payment', '9100').expect(200, { received: true });
      expect(fake.getPayment).not.toHaveBeenCalled();
      expect(await count('purchases')).toBe(0);
    });

    it('waits for the payment of a scheduled charge', async () => {
      const { preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9200', preapprovalId, paymentId: null });
      await notify('subscription_authorized_payment', '9200').expect(200);
      expect(fake.getPayment).not.toHaveBeenCalled();
      expect(await count('purchases')).toBe(0);
    });

    it('applies an approved charge: purchase, payment and plan in one go, even before the authorization notice', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9300', preapprovalId, paymentId: '530' });
      await notify('subscription_authorized_payment', '9300').expect(200);
      expect(fake.getPayment).toHaveBeenCalledWith('530');
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
      const [purchase] = await ds.query(
        `SELECT pu.amount, pu.status, pu.needs_attention, pu.auto_debit_id = ad.id AS linked, pa.mp_payment_id, pa.applied_at IS NOT NULL AS applied
         FROM purchases pu JOIN payments pa ON pa.purchase_id = pu.id JOIN auto_debits ad ON ad.external_reference = $1`,
        [ref],
      );
      expect(purchase).toEqual({ amount: 3900, status: 'approved', needs_attention: false, linked: true, mp_payment_id: '530', applied: true });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ startsOn: today(), endsOn: addMonths(today(), 1) });
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
    });

    it('activates once when the same charge is notified twice', async () => {
      const { preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9400', preapprovalId, paymentId: '540' });
      await notify('subscription_authorized_payment', '9400').expect(200);
      await notify('subscription_authorized_payment', '9400').expect(200);
      expect(await count('purchases')).toBe(1);
      expect(await count('subscriptions')).toBe(1);
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
    });

    it('flags a charge whose amount differs from the debit without activating', async () => {
      const { preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9500', preapprovalId, paymentId: '550', amount: 100 });
      await notify('subscription_authorized_payment', '9500').expect(200);
      expect(await ds.query(`SELECT status, needs_attention FROM purchases`)).toEqual([{ status: 'pending', needs_attention: true }]);
      expect(await count('subscriptions')).toBe(0);
      await notify('subscription_authorized_payment', '9500').expect(200);
      expect(await count('purchases')).toBe(1);
    });

    it('emails a rejected charge once, however many times it is notified or reconciled, and records nothing', async () => {
      const { preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9600', preapprovalId, paymentId: '560', status: 'rejected' });
      await notify('subscription_authorized_payment', '9600').expect(200);
      await notify('subscription_authorized_payment', '9600').expect(200);
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(await count('purchases')).toBe(0);
      expect(await count('subscriptions')).toBe(0);
      expect(await count(`email_logs WHERE template = 'auto-debit-charge-failed'`)).toBe(1);
      expect(await count(`email_logs WHERE idempotency_key = 'auto-debit-charge-failed:9600'`)).toBe(1);

      // Mercado Pago retries the same charge with a new payment: still one email for that charge.
      chargeInProvider({ chargeId: '9600', preapprovalId, paymentId: '561', status: 'rejected' });
      await notify('subscription_authorized_payment', '9600').expect(200);
      expect(await count(`email_logs WHERE template = 'auto-debit-charge-failed'`)).toBe(1);
    });

    it('does not email a charge that is still being processed', async () => {
      const { preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9650', preapprovalId, paymentId: '565', status: 'in_process' });
      await notify('subscription_authorized_payment', '9650').expect(200);
      expect(await count('email_logs')).toBe(0);
      expect(await count('purchases')).toBe(0);
    });

    // Barrier: a separate transaction holds the debit row, so both notifications and the reconciliation are waiting
    // on it before any of them applies the charge.
    it('activates once when the charge arrives twice while the reconciliation runs', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9700', preapprovalId, paymentId: '570' });
      const { id } = await debitRow(ref);
      const gate = ds.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      let pending: Promise<[request.Response, request.Response, { applied: number; expired: number }]> | undefined;
      try {
        await gate.query(`SELECT id FROM auto_debits WHERE id = $1 FOR UPDATE`, [id]);
        pending = Promise.all([
          notify('subscription_authorized_payment', '9700'),
          notify('subscription_authorized_payment', '9700'),
          app.get(PaymentsService).reconcilePending(new Date()),
        ]);
        await waitForLockWaiters(ds, 3);
      } finally {
        await gate.commitTransaction();
        await gate.release();
      }
      if (!pending) throw new Error('notifications were not sent');
      const [first, second] = await pending;
      expect([first.status, second.status]).toEqual([200, 200]);
      expect(await count('purchases')).toBe(1);
      expect(await count(`payments WHERE mp_payment_id = '570'`)).toBe(1);
      expect(await count('subscriptions')).toBe(1);
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ endsOn: addMonths(today(), 1) });
      expect(subs.body.upcomingPerformance).toBeNull();
    });

    it('chains a second charge after the first period (R3) and keeps the debit amount after a price change', async () => {
      const { agent, preapprovalId } = await startDebit();
      chargeInProvider({ chargeId: '9800', preapprovalId, paymentId: '580' });
      await notify('subscription_authorized_payment', '9800').expect(200);
      await ds.query(`UPDATE plans SET price = 4500 WHERE slug = 'performance-mensual'`);
      chargeInProvider({ chargeId: '9801', preapprovalId, paymentId: '581', amount: 3900 });
      await notify('subscription_authorized_payment', '9801').expect(200);
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.upcomingPerformance).toMatchObject({
        startsOn: addDays(addMonths(today(), 1), 1), endsOn: addMonths(addMonths(today(), 1), 1),
      });
      expect(await ds.query(`SELECT amount, needs_attention FROM purchases ORDER BY created_at`)).toEqual([
        { amount: 3900, needs_attention: false }, { amount: 3900, needs_attention: false },
      ]);
    });
  });

  describe('cancelling', () => {
    it('cancels in Mercado Pago before closing the debit', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      expect(fake.cancelPreapproval).toHaveBeenCalledWith(preapprovalId);
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
    });

    it('keeps the debit authorized when Mercado Pago does not cancel it', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      const { id } = await debitRow(ref);
      fake.cancelPreapproval.mockRejectedValueOnce(new Error('down'));
      const res = await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(502);
      expect(res.body.code).toBe('PAYMENT_PROVIDER_ERROR');
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
      expect(await count(`email_logs WHERE template = 'auto-debit-cancelled'`)).toBe(0);
    });

    it('closes the debit when Mercado Pago refuses because it is already cancelled there', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      preapprovals.set(preapprovalId, { ...preapprovals.get(preapprovalId)!, status: 'cancelled' });
      fake.cancelPreapproval.mockRejectedValueOnce(new Error('already cancelled'));
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
    });
  });

  describe('reconciliation', () => {
    it('applies an approved charge that never arrived by webhook', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9900', preapprovalId, paymentId: '590' });
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      expect(fake.searchAuthorizedPayments).toHaveBeenCalledWith(preapprovalId, 40);
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ startsOn: today() });

      // A second run reads nothing again and changes nothing.
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(fake.getPayment).toHaveBeenCalledTimes(1);
      expect(await count('subscriptions')).toBe(1);
    });

    it('keeps a charge flagged for its amount pending for staff instead of expiring it after 24 h (M-2)', async () => {
      const { preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9510', preapprovalId, paymentId: '551', amount: 100 });
      await notify('subscription_authorized_payment', '9510').expect(200);
      await ds.query(`UPDATE purchases SET created_at = now() - interval '25 hours'`);
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(await ds.query(`SELECT status, needs_attention FROM purchases`)).toEqual([{ status: 'pending', needs_attention: true }]);
    });

    it('does not read again a charge whose payment was finally rejected, but reads its retry (T-062 M-2)', async () => {
      const { preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9610', preapprovalId, paymentId: '562', status: 'rejected' });
      await app.get(PaymentsService).reconcilePending(new Date());
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(fake.getPayment).toHaveBeenCalledTimes(1);
      expect(await count(`email_logs WHERE template = 'auto-debit-charge-failed'`)).toBe(1);

      chargeInProvider({ chargeId: '9610', preapprovalId, paymentId: '563' });
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      expect(fake.getPayment).toHaveBeenLastCalledWith('563');
    });

    it('keeps reading a charge whose payment is still in process', async () => {
      const { preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      chargeInProvider({ chargeId: '9630', preapprovalId, paymentId: '566', status: 'in_process' });
      await app.get(PaymentsService).reconcilePending(new Date());
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(fake.getPayment).toHaveBeenCalledTimes(2);
    });

    it('does not email a rejected charge of a debit already cancelled in MOVE (T-062 M-5)', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      chargeInProvider({ chargeId: '9620', preapprovalId, paymentId: '567', status: 'rejected' });
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      await app.get(PaymentsService).reconcilePending(new Date());
      await notify('subscription_authorized_payment', '9620').expect(200);
      expect(fake.getPayment).toHaveBeenCalledWith('567');
      expect(await count(`email_logs WHERE template = 'auto-debit-charge-failed'`)).toBe(0);
    });

    it('records a cancellation made in Mercado Pago', async () => {
      const { ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      preapprovals.set(preapprovalId, { ...preapprovals.get(preapprovalId)!, status: 'cancelled' });
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled', cancelReason: 'provider' });
    });

    it('cancels pending debits older than 24 h in Mercado Pago and leaves recent ones', async () => {
      const old = await startDebit();
      const recent = await startDebit(undefined, 'recovery-paquete-4');
      await ds.query(`UPDATE auto_debits SET created_at = now() - interval '25 hours' WHERE external_reference = $1`, [old.ref]);
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect(fake.cancelPreapproval).toHaveBeenCalledWith(old.preapprovalId);
      expect(fake.cancelPreapproval).not.toHaveBeenCalledWith(recent.preapprovalId);
      expect(await debitRow(old.ref)).toMatchObject({ status: 'cancelled', cancelReason: 'expired' });
      expect(await debitRow(recent.ref)).toMatchObject({ status: 'pending' });
      expect(await count(`email_logs WHERE template = 'auto-debit-cancelled'`)).toBe(0);
    });

    it('keeps an old pending debit when Mercado Pago does not cancel it, and retries', async () => {
      const { ref, preapprovalId } = await startDebit();
      await ds.query(`UPDATE auto_debits SET created_at = now() - interval '25 hours' WHERE external_reference = $1`, [ref]);
      fake.cancelPreapproval.mockRejectedValueOnce(new Error('down'));
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(await debitRow(ref)).toMatchObject({ status: 'pending' });
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 1 });
      expect(fake.cancelPreapproval).toHaveBeenLastCalledWith(preapprovalId);
    });

    it('does not expire a debit Mercado Pago already authorized', async () => {
      const { ref, preapprovalId } = await startDebit();
      await ds.query(`UPDATE auto_debits SET created_at = now() - interval '25 hours' WHERE external_reference = $1`, [ref]);
      authorizeInProvider(preapprovalId);
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
      expect(fake.cancelPreapproval).not.toHaveBeenCalled();
    });

    it('keeps reconciling the other debits when Mercado Pago fails for one', async () => {
      const first = await startDebit();
      const second = await startDebit();
      void first;
      const third = await startDebit(undefined, 'recovery-paquete-4');
      authorizeInProvider(second.preapprovalId);
      authorizeInProvider(third.preapprovalId);
      chargeInProvider({ chargeId: '9950', preapprovalId: third.preapprovalId, paymentId: '595', amount: 3200 });
      fake.getPreapproval.mockRejectedValueOnce(new Error('down'));
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      expect(await debitRow(third.ref)).toMatchObject({ status: 'authorized' });
    });

    it('checks Mercado Pago before expiring an old pending debit whose refresh failed (M-1)', async () => {
      const { ref, preapprovalId } = await startDebit();
      await ds.query(`UPDATE auto_debits SET created_at = now() - interval '25 hours' WHERE external_reference = $1`, [ref]);
      authorizeInProvider(preapprovalId);
      fake.getPreapproval.mockRejectedValueOnce(new Error('down'));
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(fake.cancelPreapproval).not.toHaveBeenCalled();
      expect(preapprovals.get(preapprovalId)!.status).toBe('authorized');
      expect(await debitRow(ref)).toMatchObject({ status: 'authorized' });
    });

    it('leaves an old pending debit for the next run when Mercado Pago cannot be read', async () => {
      const { ref } = await startDebit();
      await ds.query(`UPDATE auto_debits SET created_at = now() - interval '25 hours' WHERE external_reference = $1`, [ref]);
      fake.getPreapproval.mockRejectedValue(new Error('down'));
      try {
        await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      } finally {
        fake.getPreapproval.mockImplementation(async (id: string) => preapprovals.get(id)!);
      }
      expect(fake.cancelPreapproval).not.toHaveBeenCalled();
      expect(await debitRow(ref)).toMatchObject({ status: 'pending' });
    });
  });

  describe('debits cancelled in MOVE that Mercado Pago still holds', () => {
    // I-1: the replaced pending debit A could not be cancelled in Mercado Pago, and the client authorizes it later.
    const replaceWithFailedCancel = async () => {
      const first = await startDebit();
      fake.cancelPreapproval.mockRejectedValueOnce(new Error('down'));
      const second = await startDebit(first.agent);
      expect(await debitRow(first.ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(preapprovals.get(first.preapprovalId)!.status).toBe('pending');
      return { first, second };
    };

    it('cancels it again in Mercado Pago when a notification reports it authorized', async () => {
      const { first, second } = await replaceWithFailedCancel();
      authorizeInProvider(first.preapprovalId);
      await notify('subscription_preapproval', first.preapprovalId).expect(200);
      expect(fake.cancelPreapproval).toHaveBeenLastCalledWith(first.preapprovalId);
      expect(preapprovals.get(first.preapprovalId)!.status).toBe('cancelled');
      expect(await debitRow(first.ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(await debitRow(second.ref)).toMatchObject({ status: 'pending' });
      expect(await count(`email_logs WHERE template = 'auto-debit-cancelled'`)).toBe(0);
    });

    it('cancels it in the reconciliation, applies what it already collected once, and nothing after that', async () => {
      const { first } = await replaceWithFailedCancel();
      authorizeInProvider(first.preapprovalId);
      chargeInProvider({ chargeId: '9960', preapprovalId: first.preapprovalId, paymentId: '596' });

      await app.get(PaymentsService).reconcilePending(new Date());
      expect(fake.cancelPreapproval).toHaveBeenLastCalledWith(first.preapprovalId);
      expect(preapprovals.get(first.preapprovalId)!.status).toBe('cancelled');
      expect(await debitRow(first.ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      expect(await count(`purchases WHERE auto_debit_id = $1`, [(await debitRow(first.ref)).id])).toBe(1);

      fake.cancelPreapproval.mockClear();
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(fake.cancelPreapproval).not.toHaveBeenCalled();
      expect(await count('purchases')).toBe(1);
      expect(await count('subscriptions')).toBe(1);
    });

    it('keeps trying when Mercado Pago fails again, and stops looking after 40 days', async () => {
      const { first } = await replaceWithFailedCancel();
      authorizeInProvider(first.preapprovalId);
      fake.cancelPreapproval.mockRejectedValueOnce(new Error('down'));
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(preapprovals.get(first.preapprovalId)!.status).toBe('authorized');
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(preapprovals.get(first.preapprovalId)!.status).toBe('cancelled');

      authorizeInProvider(first.preapprovalId);
      await ds.query(`UPDATE auto_debits SET cancelled_at = now() - interval '41 days' WHERE external_reference = $1`, [first.ref]);
      fake.getPreapproval.mockClear();
      await app.get(PaymentsService).reconcilePending(new Date());
      expect(fake.getPreapproval).not.toHaveBeenCalledWith(first.preapprovalId);
    });

    // I-2: without webhooks, a charge approved before the client cancels is only seen by the reconciliation.
    it('applies once a charge approved before the client cancelled, seen only by the reconciliation', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      chargeInProvider({ chargeId: '9970', preapprovalId, paymentId: '597' });
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);

      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });
      expect(await count('purchases')).toBe(1);
      expect(await count(`email_logs WHERE template = 'purchase-approved'`)).toBe(1);
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled', cancelReason: 'client' });
      const subs = await agent.get('/api/me/subscriptions').expect(200);
      expect(subs.body.performance).toMatchObject({ startsOn: today(), endsOn: addMonths(today(), 1) });
    });

    it('applies a charge approved after the cancellation once its payment leaves in_process', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      chargeInProvider({ chargeId: '9980', preapprovalId, paymentId: '598', status: 'in_process' });
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 0, expired: 0 });

      chargeInProvider({ chargeId: '9980', preapprovalId, paymentId: '598', status: 'approved' });
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
      expect(await count('purchases')).toBe(1);
      expect(await debitRow(ref)).toMatchObject({ status: 'cancelled' });
    });

    it('applies the charges of a cancelled debit even when Mercado Pago cannot report its state', async () => {
      const { agent, ref, preapprovalId } = await startDebit();
      authorizeInProvider(preapprovalId);
      await notify('subscription_preapproval', preapprovalId).expect(200);
      chargeInProvider({ chargeId: '9990', preapprovalId, paymentId: '599' });
      const { id } = await debitRow(ref);
      await agent.post(`/api/me/auto-debits/${id}/cancel`).expect(200);
      fake.getPreapproval.mockRejectedValueOnce(new Error('down'));
      await expect(app.get(PaymentsService).reconcilePending(new Date())).resolves.toEqual({ applied: 1, expired: 0 });
    });
  });
});
