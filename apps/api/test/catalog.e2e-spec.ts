import request from 'supertest';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';

const validPlan = { service: 'performance', kind: 'period_plan', slug: 'performance-anual', name: 'Plan Anual', price: 36000, periodMonths: 12 };

describe('catalog (e2e)', () => {
  let ctx: TestApp;
  let staff: TestAgent;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => {
    await resetDb(ctx.dataSource);
    await seedCatalogAndSchedule(ctx.dataSource);
    staff = (await signUpStaff(ctx.app, ctx.dataSource)).agent;
  });

  const publicGet = (path: string) => request(ctx.app.getHttpServer()).get(path);
  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);

  it('lists active plans publicly in order', async () => {
    const res = await request(ctx.app.getHttpServer()).get('/api/catalog/plans?service=performance').expect(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual(['performance-mensual', 'performance-trimestral', 'performance-semestral']);
    expect(res.body[1]).toMatchObject({ price: 10500, currency: 'UYU', periodMonths: 3, featured: true });
  });

  it('returns the PlanDto shape and lists every service when no filter is given', async () => {
    const res = await publicGet('/api/catalog/plans').expect(200);
    expect(res.body).toHaveLength(7);
    const pack = res.body.find((p: { slug: string }) => p.slug === 'recovery-paquete-4');
    expect(pack).toEqual({
      id: expect.any(String), service: 'recovery', kind: 'session_pack', slug: 'recovery-paquete-4', name: 'Paquete 4 sesiones',
      description: 'Recovery Room by MOVE, abierta a todo público.', features: expect.any(Array), price: 3200, currency: 'UYU',
      periodMonths: null, periodDays: 30, sessionsIncluded: 4, durationMinutes: 45, featured: true, active: true, sortOrder: 2,
    });
  });

  it('rejects an unknown service filter', async () => {
    await publicGet('/api/catalog/plans?service=gym').expect(400).expect(expectCode('VALIDATION_FAILED'));
    await publicGet('/api/catalog/plans?service=performance&service=rehab').expect(400);
  });

  it('gets an active plan by slug and hides inactive, deleted or unknown ones', async () => {
    await publicGet('/api/catalog/plans/performance-mensual').expect(200).expect((r) => expect(r.body).toMatchObject({ slug: 'performance-mensual', price: 3900 }));
    await publicGet('/api/catalog/plans/nope').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await publicGet('/api/catalog/plans/%00').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    const created = await staff.post('/api/staff/plans').send(validPlan).expect(201);
    await staff.patch(`/api/staff/plans/${created.body.id}`).send({ active: false }).expect(200);
    await publicGet('/api/catalog/plans/performance-anual').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.patch(`/api/staff/plans/${created.body.id}`).send({ active: true }).expect(200);
    await publicGet('/api/catalog/plans/performance-anual').expect(200);
    await staff.delete(`/api/staff/plans/${created.body.id}`).expect(204);
    await publicGet('/api/catalog/plans/performance-anual').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
  });

  it('lets staff manage plans and hides inactive ones from the public list', async () => {
    const created = await staff.post('/api/staff/plans').send(validPlan).expect(201);
    expect(created.body).toMatchObject({ slug: 'performance-anual', currency: 'UYU', featured: false, active: true, sortOrder: 0, description: '', features: [] });
    await staff.post('/api/staff/plans')
      .send({ service: 'performance', kind: 'period_plan', slug: 'performance-anual', name: 'Dup', price: 1, periodMonths: 1 })
      .expect(409).expect(expectCode('SLUG_TAKEN'));
    await staff.patch(`/api/staff/plans/${created.body.id}`).send({ active: false }).expect(200);
    const pub = await request(ctx.app.getHttpServer()).get('/api/catalog/plans?service=performance').expect(200);
    expect(pub.body.some((p: { slug: string }) => p.slug === 'performance-anual')).toBe(false);
    await staff.delete(`/api/staff/plans/${created.body.id}`).expect(204);
  });

  it('soft deletes: the row stays with deleted_at and disappears from staff lists', async () => {
    const created = await staff.post('/api/staff/plans').send(validPlan).expect(201);
    await staff.delete(`/api/staff/plans/${created.body.id}`).expect(204);
    const rows = await ctx.dataSource.query(`SELECT deleted_at FROM plans WHERE id = $1`, [created.body.id]);
    expect(rows[0].deleted_at).not.toBeNull();
    const list = await staff.get('/api/staff/plans?includeInactive=true').expect(200);
    expect(list.body.some((p: { id: string }) => p.id === created.body.id)).toBe(false);
    await staff.delete(`/api/staff/plans/${created.body.id}`).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.patch(`/api/staff/plans/${created.body.id}`).send({ name: 'Otro nombre' }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.post('/api/staff/plans').send(validPlan).expect(409).expect(expectCode('SLUG_TAKEN'));
  });

  it('lists plans for staff, with inactive ones only on request', async () => {
    const created = await staff.post('/api/staff/plans').send({ ...validPlan, active: false }).expect(201);
    const onlyActive = await staff.get('/api/staff/plans').expect(200);
    expect(onlyActive.body).toHaveLength(7);
    const all = await staff.get('/api/staff/plans?includeInactive=true').expect(200);
    expect(all.body).toHaveLength(8);
    expect(all.body.some((p: { id: string }) => p.id === created.body.id)).toBe(true);
    const recovery = await staff.get('/api/staff/plans?service=recovery&includeInactive=true').expect(200);
    expect(recovery.body.map((p: { slug: string }) => p.slug)).toEqual(['recovery-sesion', 'recovery-paquete-4', 'recovery-paquete-8']);
    await staff.get('/api/staff/plans?includeInactive=maybe').expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('edits one field and leaves the others intact', async () => {
    const [before] = (await staff.get('/api/staff/plans?service=performance').expect(200)).body;
    const res = await staff.patch(`/api/staff/plans/${before.id}`).send({ price: 4100 }).expect(200);
    expect(res.body).toEqual({ ...before, price: 4100 });
    const after = (await staff.get('/api/staff/plans?service=performance').expect(200)).body[0];
    expect(after).toEqual({ ...before, price: 4100 });
  });

  it('edits slug, name, features, flags and sort order', async () => {
    const [before] = (await staff.get('/api/staff/plans?service=performance').expect(200)).body;
    const res = await staff.patch(`/api/staff/plans/${before.id}`)
      .send({ slug: 'mensual-nuevo', name: '  Mensual Plus  ', description: 'Nueva', features: ['  Uno  ', 'Dos'], featured: true, sortOrder: 9, periodMonths: 2 })
      .expect(200);
    expect(res.body).toMatchObject({ slug: 'mensual-nuevo', name: 'Mensual Plus', description: 'Nueva', features: ['Uno', 'Dos'], featured: true, sortOrder: 9, periodMonths: 2, price: 3900 });
  });

  it('does not let a PATCH change service or kind', async () => {
    const [plan] = (await staff.get('/api/staff/plans?service=performance').expect(200)).body;
    await staff.patch(`/api/staff/plans/${plan.id}`).send({ service: 'recovery' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
    await staff.patch(`/api/staff/plans/${plan.id}`).send({ kind: 'session_pack' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('rejects a PATCH that breaks the plan shape or reuses a slug', async () => {
    const [plan, other] = (await staff.get('/api/staff/plans?service=performance').expect(200)).body;
    await staff.patch(`/api/staff/plans/${plan.id}`).send({ sessionsIncluded: 4 }).expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    await staff.patch(`/api/staff/plans/${plan.id}`).send({ durationMinutes: 60 }).expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    await staff.patch(`/api/staff/plans/${plan.id}`).send({ slug: other.slug }).expect(409).expect(expectCode('SLUG_TAKEN'));
    const unchanged = (await staff.get('/api/staff/plans?service=performance').expect(200)).body[0];
    expect(unchanged).toEqual(plan);
  });

  it('answers 404 for unknown or malformed plan ids', async () => {
    await staff.patch('/api/staff/plans/00000000-0000-4000-8000-000000000000').send({ price: 1 }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.delete('/api/staff/plans/00000000-0000-4000-8000-000000000000').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.patch('/api/staff/plans/not-a-uuid').send({ price: 1 }).expect(404).expect(expectCode('PLAN_NOT_FOUND'));
    await staff.delete('/api/staff/plans/not-a-uuid').expect(404).expect(expectCode('PLAN_NOT_FOUND'));
  });

  it('rejects invalid shapes and non-staff users', async () => {
    await staff.post('/api/staff/plans')
      .send({ service: 'recovery', kind: 'period_plan', slug: 'bad', name: 'Bad', price: 1, periodMonths: 1 })
      .expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    await staff.post('/api/staff/plans')
      .send({ service: 'recovery', kind: 'session_pack', slug: 'bad', name: 'Bad', price: 1, periodDays: 30 })
      .expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    await staff.post('/api/staff/plans')
      .send({ ...validPlan, sessionsIncluded: 4 })
      .expect(400).expect(expectCode('PLAN_KIND_INVALID'));
    const client = await signUpClient(ctx.app);
    await client.agent.get('/api/staff/plans').expect(403).expect(expectCode('FORBIDDEN'));
    await request(ctx.app.getHttpServer()).get('/api/staff/plans').expect(401).expect(expectCode('UNAUTHENTICATED'));
  });

  it('blocks clients and anonymous users from every staff plan write', async () => {
    const [plan] = (await staff.get('/api/staff/plans').expect(200)).body;
    const client = await signUpClient(ctx.app);
    await client.agent.post('/api/staff/plans').send(validPlan).expect(403);
    await client.agent.patch(`/api/staff/plans/${plan.id}`).send({ price: 1 }).expect(403);
    await client.agent.delete(`/api/staff/plans/${plan.id}`).expect(403);
    const http = () => request(ctx.app.getHttpServer());
    await http().post('/api/staff/plans').send(validPlan).expect(401);
    await http().patch(`/api/staff/plans/${plan.id}`).send({ price: 1 }).expect(401);
    await http().delete(`/api/staff/plans/${plan.id}`).expect(401);
    const unchanged = (await staff.get('/api/staff/plans').expect(200)).body[0];
    expect(unchanged.id).toBe(plan.id);
    expect(unchanged.price).toBe(plan.price);
  });

  describe('input validation', () => {
    const post = (body: Record<string, unknown>) => staff.post('/api/staff/plans').send({ ...validPlan, ...body });
    const rejected = async (body: Record<string, unknown>) => {
      const res = await post(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    };

    it.each([
      ['missing required fields', { name: undefined }],
      ['missing price', { price: undefined }],
      ['unknown service', { service: 'gym' }],
      ['unknown kind', { kind: 'yearly' }],
      ['non kebab-case slug', { slug: 'Plan Anual' }],
      ['slug over 80 chars', { slug: 'a'.repeat(81) }],
      ['name shorter than 2', { name: 'A' }],
      ['name over 80 chars', { name: 'N'.repeat(81) }],
      ['blank name', { name: '    ' }],
      ['NUL in name', { name: 'Plan\u0000Anual' }],
      ['null name', { name: null }],
      ['description over 500', { description: 'd'.repeat(501) }],
      ['NUL in description', { description: 'a\u0000b' }],
      ['null description', { description: null }],
      ['more than 10 features', { features: Array.from({ length: 11 }, (_, i) => `f${i}`) }],
      ['feature over 120 chars', { features: ['f'.repeat(121)] }],
      ['blank feature', { features: ['   '] }],
      ['NUL in feature', { features: ['a\u0000b'] }],
      ['non array features', { features: 'uno' }],
      ['null features', { features: null }],
      ['negative price', { price: -1 }],
      ['price over 10.000.000', { price: 10_000_001 }],
      ['extreme price', { price: 1e20 }],
      ['fractional price', { price: 10.5 }],
      ['string price', { price: '100' }],
      ['null price', { price: null }],
      ['periodMonths 0', { periodMonths: 0 }],
      ['periodMonths over 36', { periodMonths: 37 }],
      ['extreme periodMonths', { periodMonths: 1e20 }],
      ['null periodMonths', { periodMonths: null }],
      ['periodDays over 365', { periodDays: 366 }],
      ['sessionsIncluded over 100', { sessionsIncluded: 101 }],
      ['durationMinutes under 15', { durationMinutes: 14 }],
      ['durationMinutes over 240', { durationMinutes: 241 }],
      ['non boolean featured', { featured: 'yes' }],
      ['null active', { active: null }],
      ['negative sortOrder', { sortOrder: -1 }],
      ['sortOrder over 999', { sortOrder: 1000 }],
      ['extreme sortOrder', { sortOrder: 1e20 }],
      ['unknown field', { color: 'red' }],
    ])('rejects %s on create', async (_label, body) => { await rejected(body); });

    it.each([
      ['null name', { name: null }],
      ['blank name', { name: '   ' }],
      ['NUL in name', { name: 'a\u0000b' }],
      ['null slug', { slug: null }],
      ['null price', { price: null }],
      ['null description', { description: null }],
      ['null features', { features: null }],
      ['null periodMonths', { periodMonths: null }],
      ['null featured', { featured: null }],
      ['null active', { active: null }],
      ['null sortOrder', { sortOrder: null }],
      ['extreme price', { price: 1e20 }],
      ['extreme sortOrder', { sortOrder: 1e20 }],
      ['price over 10.000.000', { price: 10_000_001 }],
    ])('rejects %s on patch', async (_label, body) => {
      const [plan] = (await staff.get('/api/staff/plans?service=performance').expect(200)).body;
      const res = await staff.patch(`/api/staff/plans/${plan.id}`).send(body).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
    });

    it('accepts the upper bounds', async () => {
      const res = await post({ slug: 'a'.repeat(80), name: 'N'.repeat(80), description: 'd'.repeat(500), price: 10_000_000, periodMonths: 36, sortOrder: 999, features: Array.from({ length: 10 }, () => 'f'.repeat(120)) }).expect(201);
      expect(res.body).toMatchObject({ price: 10_000_000, periodMonths: 36, sortOrder: 999 });
      expect(res.body.features).toHaveLength(10);
    });

    it('trims the name', async () => {
      const res = await post({ name: '  Plan Anual  ' }).expect(201);
      expect(res.body.name).toBe('Plan Anual');
    });
  });
});
