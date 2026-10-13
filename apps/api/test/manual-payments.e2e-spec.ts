import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { planIdBySlug } from './utils/fixtures.js';

describe('manual payments (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const expectCode = (code: string) => (r: request.Response) => expect(r.body.code).toBe(code);

  it('records a cash payment that activates the plan and emails it once', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const planId = await planIdBySlug(ctx.dataSource, 'performance-trimestral');

    const res = await staff.agent.post('/api/staff/payments/manual')
      .send({ userId: client.userId, planId, method: 'cash', amount: 10500, note: '  Pagó en recepción  ' })
      .expect(201);
    expect(res.body).toMatchObject({
      client: { id: client.userId, name: 'Usuario Test', email: client.email }, itemName: 'Plan Trimestral', service: 'performance',
      amount: 10500, method: 'cash', status: 'approved', needsAttention: false, note: 'Pagó en recepción',
    });
    expect(res.body.approvedAt).not.toBeNull();

    const subs = await client.agent.get('/api/me/subscriptions').expect(200);
    expect(subs.body.performance).toMatchObject({ planName: 'Plan Trimestral', startsOn: businessToday() });
    const [purchase] = await ctx.dataSource.query(`SELECT recorded_by, method, status FROM purchases WHERE id = $1`, [res.body.purchaseId]);
    expect(purchase).toEqual({ recorded_by: staff.userId, method: 'cash', status: 'approved' });
    const [payment] = await ctx.dataSource.query(`SELECT status, mp_payment_id, amount, applied_at FROM payments WHERE purchase_id = $1`, [res.body.purchaseId]);
    expect(payment).toMatchObject({ status: 'approved', mp_payment_id: null, amount: 10500 });
    expect(payment.applied_at).not.toBeNull();
    const [{ count }] = await ctx.dataSource.query(
      `SELECT count(*)::int AS count FROM email_logs WHERE idempotency_key = $1`, [`purchase-approved:${res.body.purchaseId}`],
    );
    expect(count).toBe(1);
  });

  it('renews from the current end date and activates Recovery packs', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const monthly = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId: monthly, method: 'transfer', amount: 3900 }).expect(201);
    await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId: monthly, method: 'transfer', amount: 3900 }).expect(201);
    const pack = await planIdBySlug(ctx.dataSource, 'recovery-paquete-8');
    await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId: pack, method: 'cash', amount: 0 }).expect(201);

    const subs = await client.agent.get('/api/me/subscriptions').expect(200);
    expect(subs.body.upcomingPerformance).not.toBeNull();
    expect(subs.body.upcomingPerformance.startsOn > subs.body.performance.endsOn).toBe(true);
    expect(subs.body.recoveryPacks).toEqual([expect.objectContaining({ sessionsTotal: 8 })]);
  });

  it('lists payments filtered and paginated, newest first', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const monthly = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    const cash = await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId: monthly, method: 'cash', amount: 3900 }).expect(201);
    const transfer = await staff.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId: monthly, method: 'transfer', amount: 3900 }).expect(201);
    await ctx.dataSource.query(`UPDATE purchases SET created_at = now() - interval '1 hour' WHERE id = $1`, [cash.body.purchaseId]);
    const quarterly = await planIdBySlug(ctx.dataSource, 'performance-trimestral');
    await client.agent.post('/api/checkout/plan').send({ planId: quarterly }).expect(201);

    const byCash = await staff.agent.get('/api/staff/payments?method=cash').expect(200);
    expect(byCash.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(byCash.body.items.map((p: { purchaseId: string }) => p.purchaseId)).toEqual([cash.body.purchaseId]);

    const all = await staff.agent.get('/api/staff/payments').expect(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items[0]).toMatchObject({ method: 'mercadopago', status: 'pending', approvedAt: null });
    expect(all.body.items[2].purchaseId).toBe(cash.body.purchaseId);

    const page2 = await staff.agent.get('/api/staff/payments?page=2&pageSize=1').expect(200);
    expect(page2.body).toMatchObject({ total: 3, page: 2, pageSize: 1 });
    expect(page2.body.items.map((p: { purchaseId: string }) => p.purchaseId)).toEqual([transfer.body.purchaseId]);

    const pending = await staff.agent.get('/api/staff/payments?status=pending').expect(200);
    expect(pending.body.total).toBe(1);
    await ctx.dataSource.query(`UPDATE purchases SET needs_attention = true WHERE id = $1`, [transfer.body.purchaseId]);
    const flagged = await staff.agent.get('/api/staff/payments?needsAttention=true').expect(200);
    expect(flagged.body.items.map((p: { purchaseId: string }) => p.purchaseId)).toEqual([transfer.body.purchaseId]);

    await staff.agent.get('/api/staff/payments?status=paid').expect(400).expect(expectCode('VALIDATION_FAILED'));
    await staff.agent.get('/api/staff/payments?pageSize=1000').expect(400).expect(expectCode('VALIDATION_FAILED'));
    await staff.agent.get('/api/staff/payments?needsAttention=yes').expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('is staff only', async () => {
    const client = await signUpClient(ctx.app);
    await client.agent.get('/api/staff/payments').expect(403).expect(expectCode('FORBIDDEN'));
    await request(ctx.app.getHttpServer()).get('/api/staff/payments').expect(401).expect(expectCode('UNAUTHENTICATED'));
    const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    await client.agent.post('/api/staff/payments/manual').send({ userId: client.userId, planId, method: 'cash', amount: 3900 })
      .expect(403).expect(expectCode('FORBIDDEN'));
  });

  it('rejects other plan kinds, unknown users and plans', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const evaluation = await planIdBySlug(ctx.dataSource, 'rehab-evaluacion');
    const monthly = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    const post = (body: Record<string, unknown>) => staff.agent.post('/api/staff/payments/manual').send(body);

    await post({ userId: client.userId, planId: evaluation, method: 'cash', amount: 1800 }).expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    await post({ userId: randomUUID(), planId: monthly, method: 'cash', amount: 3900 }).expect(404).expect(expectCode('USER_NOT_FOUND'));
    await post({ userId: staff.userId, planId: monthly, method: 'cash', amount: 3900 }).expect(404).expect(expectCode('USER_NOT_FOUND'));
    await post({ userId: client.userId, planId: randomUUID(), method: 'cash', amount: 3900 }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM purchases`);
    expect(count).toBe(0);
  });

  it('validates the body', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const client = await signUpClient(ctx.app);
    const planId = await planIdBySlug(ctx.dataSource, 'performance-mensual');
    const base = { userId: client.userId, planId, method: 'cash', amount: 3900 };
    const invalid = (body: Record<string, unknown>) =>
      staff.agent.post('/api/staff/payments/manual').send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));

    await invalid({ ...base, method: 'mercadopago' });
    await invalid({ ...base, amount: -1 });
    await invalid({ ...base, amount: 1e20 });
    await invalid({ ...base, amount: 10_000_001 });
    await invalid({ ...base, amount: 10.5 });
    await invalid({ ...base, amount: null });
    await invalid({ ...base, note: 'x'.repeat(501) });
    await invalid({ ...base, note: 'nota\u0000' });
    await invalid({ ...base, userId: 'nope' });
    await invalid({ ...base, extra: 1 });
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM purchases`);
    expect(count).toBe(0);
  });
});
