import request from 'supertest';
import { addDays, businessDateTime, businessDayEnd, businessDayStart, businessToday, isoWeekday } from '../src/common/time/business-time.js';
import { JobRunner } from '../src/common/scheduling/job-runner.service.js';
import { ScheduleService } from '../src/modules/schedule/services/schedule.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';

describe('schedule (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });

  const countSlots = async (): Promise<number> => {
    const [{ count }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM time_slots`);
    return count as number;
  };
  const tomorrow = () => addDays(businessToday(), 1);
  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);

  async function createProfessional(agent: TestAgent, name = 'Fisio Uno'): Promise<string> {
    const res = await agent.post('/api/staff/professionals').send({ name }).expect(201);
    return res.body.id as string;
  }

  it('creates templates, generates idempotently and validates rehab', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const pro = await agent.post('/api/staff/professionals').send({ name: 'Fisio Uno' }).expect(201);
    await agent.post('/api/staff/schedule/templates')
      .send({ service: 'rehab', weekday: 2, startTime: '11:00', durationMinutes: 60, capacity: 2, professionalId: pro.body.id })
      .expect(400).expect((r) => expect(r.body.code).toBe('TEMPLATE_INVALID'));
    for (let weekday = 1; weekday <= 7; weekday += 1) {
      await agent.post('/api/staff/schedule/templates')
        .send({ service: 'performance', weekday, startTime: '23:59', durationMinutes: 60, capacity: 14 }).expect(201);
    }
    const [{ count: first }] = await ctx.dataSource.query(`SELECT count(*)::int AS count FROM time_slots`);
    expect(first).toBeGreaterThanOrEqual(14);
    const again = await agent.post('/api/staff/schedule/generate').send({}).expect(201);
    expect(again.body.created).toBe(0);
  });

  it('locks a slot row inside a transaction', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const slot = await agent.post('/api/staff/time-slots')
      .send({ service: 'performance', date: addDays(businessToday(), 1), startTime: '19:00', durationMinutes: 60, capacity: 14 }).expect(201);
    const schedule = ctx.app.get(ScheduleService);
    const locked = await ctx.dataSource.transaction((m) => schedule.lockSlot(m, slot.body.id));
    expect(locked).toMatchObject({ id: slot.body.id, capacity: 14 });
    await expect(ctx.dataSource.transaction((m) => schedule.lockSlot(m, '00000000-0000-0000-0000-000000000000')))
      .rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
  });

  it('is staff only', async () => {
    const { agent } = await signUpClient(ctx.app);
    await agent.get('/api/staff/schedule/templates').expect(403);
  });

  describe('access control', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const routes: ['get' | 'post' | 'patch' | 'delete', string][] = [
      ['get', '/api/staff/professionals'],
      ['post', '/api/staff/professionals'],
      ['patch', `/api/staff/professionals/${id}`],
      ['get', '/api/staff/schedule/templates'],
      ['post', '/api/staff/schedule/templates'],
      ['patch', `/api/staff/schedule/templates/${id}`],
      ['delete', `/api/staff/schedule/templates/${id}`],
      ['post', '/api/staff/time-slots'],
      ['post', '/api/staff/schedule/generate'],
    ];

    it('answers 403 to clients on every endpoint', async () => {
      const { agent } = await signUpClient(ctx.app);
      for (const [method, path] of routes) {
        const r = await agent[method](path).send({});
        expect([method, path, r.status, r.body.code]).toEqual([method, path, 403, 'FORBIDDEN']);
      }
    });

    it('answers 401 without a session on every endpoint', async () => {
      for (const [method, path] of routes) {
        const r = await request(ctx.app.getHttpServer())[method](path).send({});
        expect([method, path, r.status, r.body.code]).toEqual([method, path, 401, 'UNAUTHENTICATED']);
      }
    });
  });

  describe('professionals', () => {
    it('creates, lists and patches one field at a time', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const id = await createProfessional(agent, '  Ana Pérez  ');
      const list = await agent.get('/api/staff/professionals').expect(200);
      expect(list.body).toEqual([{ id, name: 'Ana Pérez', active: true }]);

      await agent.patch(`/api/staff/professionals/${id}`).send({ active: false }).expect(200)
        .expect((r) => expect(r.body).toEqual({ id, name: 'Ana Pérez', active: false }));
      await agent.patch(`/api/staff/professionals/${id}`).send({ name: 'Ana P.' }).expect(200)
        .expect((r) => expect(r.body).toEqual({ id, name: 'Ana P.', active: false }));
    });

    it('answers PROFESSIONAL_NOT_FOUND for an unknown id and 400 for a malformed one', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.patch('/api/staff/professionals/11111111-1111-4111-8111-111111111111').send({ name: 'Nombre' })
        .expect(404).expect(expectCode('PROFESSIONAL_NOT_FOUND'));
      await agent.patch('/api/staff/professionals/not-a-uuid').send({ name: 'Nombre' })
        .expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it.each([
      ['empty name', { name: '' }],
      ['whitespace-only name', { name: '    ' }],
      ['NUL byte', { name: 'Ana\u0000Pérez' }],
      ['too long name', { name: 'a'.repeat(81) }],
      ['non-string name', { name: 12 }],
      ['missing name', {}],
      ['unknown field', { name: 'Ana Pérez', role: 'staff' }],
    ])('rejects a create with %s', async (_label, body) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/professionals').send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it.each([
      ['null name', { name: null }],
      ['null active', { active: null }],
      ['NUL byte', { name: 'Ana\u0000' }],
      ['whitespace-only name', { name: '   ' }],
      ['non-boolean active', { active: 'yes' }],
    ])('rejects a patch with %s', async (_label, body) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const id = await createProfessional(agent);
      await agent.patch(`/api/staff/professionals/${id}`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });

  describe('templates', () => {
    const tomorrowWeekday = () => isoWeekday(tomorrow());
    const baseTemplate = () => ({ service: 'performance', weekday: tomorrowWeekday(), startTime: '19:00', durationMinutes: 60, capacity: 14 });

    it('generates one slot per matching date at the local start time inside the booking window', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const res = await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      expect(res.body).toMatchObject({ ...baseTemplate(), professionalId: null, professionalName: null, active: true });

      // Window = today … today + 14, both included: tomorrow and tomorrow + 7 match; tomorrow + 14 is day 15.
      const slots: { starts_at: Date; ends_at: Date; capacity: number; template_id: string }[] = await ctx.dataSource.query(
        `SELECT starts_at, ends_at, capacity, template_id FROM time_slots ORDER BY starts_at`,
      );
      expect(slots.map((s) => s.starts_at.toISOString())).toEqual([
        businessDateTime(tomorrow(), '19:00').toISOString(),
        businessDateTime(addDays(tomorrow(), 7), '19:00').toISOString(),
      ]);
      expect(slots[0].ends_at.getTime() - slots[0].starts_at.getTime()).toBe(60 * 60_000);
      expect(slots.every((s) => s.template_id === res.body.id && s.capacity === 14)).toBe(true);
    });

    it('lists templates ordered by weekday and start time, filtered by service', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const pro = await createProfessional(agent);
      await agent.post('/api/staff/schedule/templates').send({ service: 'performance', weekday: 3, startTime: '18:00', durationMinutes: 60, capacity: 14 }).expect(201);
      await agent.post('/api/staff/schedule/templates').send({ service: 'performance', weekday: 1, startTime: '20:00', durationMinutes: 60, capacity: 14 }).expect(201);
      await agent.post('/api/staff/schedule/templates').send({ service: 'performance', weekday: 1, startTime: '07:00', durationMinutes: 60, capacity: 14 }).expect(201);
      await agent.post('/api/staff/schedule/templates').send({ service: 'rehab', weekday: 2, startTime: '09:00', durationMinutes: 60, capacity: 1, professionalId: pro }).expect(201);

      const all = await agent.get('/api/staff/schedule/templates').expect(200);
      expect(all.body.map((t: { weekday: number; startTime: string }) => `${t.weekday} ${t.startTime}`)).toEqual(['1 07:00', '1 20:00', '2 09:00', '3 18:00']);
      const rehab = await agent.get('/api/staff/schedule/templates?service=rehab').expect(200);
      expect(rehab.body).toEqual([expect.objectContaining({ service: 'rehab', professionalId: pro, professionalName: 'Fisio Uno', capacity: 1 })]);
      await agent.get('/api/staff/schedule/templates?service=nope').expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('does not duplicate slots when generating twice', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      const before = await countSlots();
      expect(before).toBeGreaterThan(0);
      await agent.post('/api/staff/schedule/generate').send({}).expect(201).expect((r) => expect(r.body).toEqual({ created: 0 }));
      expect(await countSlots()).toBe(before);
      const wider = await agent.post('/api/staff/schedule/generate').send({ days: 60 }).expect(201);
      expect(wider.body.created).toBeGreaterThan(0);
      const after = await countSlots();
      await agent.post('/api/staff/schedule/generate').send({ days: 60 }).expect(201).expect((r) => expect(r.body).toEqual({ created: 0 }));
      expect(await countSlots()).toBe(after);
    });

    it('stops generating when a template is deactivated or deleted and leaves existing slots alone', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const first = await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      const second = await agent.post('/api/staff/schedule/templates').send({ ...baseTemplate(), startTime: '20:00' }).expect(201);
      const generated = await countSlots();
      expect(generated).toBeGreaterThan(0);

      await agent.patch(`/api/staff/schedule/templates/${first.body.id}`).send({ active: false }).expect(200)
        .expect((r) => expect(r.body.active).toBe(false));
      await agent.delete(`/api/staff/schedule/templates/${second.body.id}`).expect(204);
      await agent.post('/api/staff/schedule/generate').send({ days: 60 }).expect(201)
        .expect((r) => expect(r.body).toEqual({ created: 0 }));
      expect(await countSlots()).toBe(generated);

      const list = await agent.get('/api/staff/schedule/templates').expect(200);
      expect(list.body.map((t: { id: string }) => t.id)).toEqual([first.body.id]);
      await agent.delete(`/api/staff/schedule/templates/${second.body.id}`).expect(404).expect(expectCode('TEMPLATE_NOT_FOUND'));
    });

    it('applies an edit only to slots generated afterwards and keeps unpatched fields', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const created = await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      const before: { id: string; capacity: number }[] = await ctx.dataSource.query(`SELECT id, capacity FROM time_slots ORDER BY starts_at`);

      const capacityOnly = await agent.patch(`/api/staff/schedule/templates/${created.body.id}`).send({ capacity: 10 }).expect(200);
      expect(capacityOnly.body).toMatchObject({ startTime: '19:00', durationMinutes: 60, capacity: 10, active: true });
      expect(await ctx.dataSource.query(`SELECT id, capacity FROM time_slots ORDER BY starts_at`)).toEqual(before);

      await agent.patch(`/api/staff/schedule/templates/${created.body.id}`).send({ startTime: '20:00' }).expect(200)
        .expect((r) => expect(r.body).toMatchObject({ startTime: '20:00', durationMinutes: 60, capacity: 10 }));
      const after: { starts_at: Date; capacity: number }[] = await ctx.dataSource.query(`SELECT starts_at, capacity FROM time_slots ORDER BY starts_at`);
      expect(after).toHaveLength(before.length * 2);
      expect(after.filter((s) => s.capacity === 14)).toHaveLength(before.length);
      expect(after.filter((s) => s.capacity === 10).map((s) => s.starts_at.toISOString())).toEqual([
        businessDateTime(tomorrow(), '20:00').toISOString(),
        businessDateTime(addDays(tomorrow(), 7), '20:00').toISOString(),
      ]);
    });

    it('answers TEMPLATE_NOT_FOUND when patching an unknown or deleted template', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.patch('/api/staff/schedule/templates/11111111-1111-4111-8111-111111111111').send({ capacity: 3 })
        .expect(404).expect(expectCode('TEMPLATE_NOT_FOUND'));
      const created = await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      await agent.delete(`/api/staff/schedule/templates/${created.body.id}`).expect(204);
      await agent.patch(`/api/staff/schedule/templates/${created.body.id}`).send({ capacity: 3 })
        .expect(404).expect(expectCode('TEMPLATE_NOT_FOUND'));
    });

    it('requires a professional and capacity 1 for rehab on create and on edit', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const pro = await createProfessional(agent);
      const rehab = { service: 'rehab', weekday: tomorrowWeekday(), startTime: '10:00', durationMinutes: 60, capacity: 1 };

      await agent.post('/api/staff/schedule/templates').send(rehab).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.post('/api/staff/schedule/templates').send({ ...rehab, professionalId: null }).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.post('/api/staff/schedule/templates').send({ ...rehab, capacity: 2, professionalId: pro }).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.post('/api/staff/schedule/templates').send({ ...rehab, professionalId: '11111111-1111-4111-8111-111111111111' })
        .expect(404).expect(expectCode('PROFESSIONAL_NOT_FOUND'));
      expect(await countSlots()).toBe(0);

      const ok = await agent.post('/api/staff/schedule/templates').send({ ...rehab, professionalId: pro }).expect(201);
      expect(ok.body).toMatchObject({ service: 'rehab', capacity: 1, professionalId: pro, professionalName: 'Fisio Uno' });
      const slots: { professional_id: string; capacity: number; service: string }[] = await ctx.dataSource.query(`SELECT professional_id, capacity, service FROM time_slots`);
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.every((s) => s.professional_id === pro && s.capacity === 1 && s.service === 'rehab')).toBe(true);

      const url = `/api/staff/schedule/templates/${ok.body.id}`;
      await agent.patch(url).send({ capacity: 2 }).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.patch(url).send({ professionalId: null }).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.patch(url).send({ professionalId: '11111111-1111-4111-8111-111111111111' }).expect(404).expect(expectCode('PROFESSIONAL_NOT_FOUND'));
      await agent.patch(url).send({ startTime: '11:00' }).expect(200).expect((r) => expect(r.body).toMatchObject({ capacity: 1, professionalId: pro }));
    });

    it('rejects an unknown professional on a non-rehab template and allows clearing it', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/templates').send({ ...baseTemplate(), professionalId: '11111111-1111-4111-8111-111111111111' })
        .expect(404).expect(expectCode('PROFESSIONAL_NOT_FOUND'));
      const pro = await createProfessional(agent);
      const created = await agent.post('/api/staff/schedule/templates').send({ ...baseTemplate(), professionalId: pro }).expect(201);
      expect(created.body.professionalId).toBe(pro);
      await agent.patch(`/api/staff/schedule/templates/${created.body.id}`).send({ professionalId: null }).expect(200)
        .expect((r) => expect(r.body).toMatchObject({ professionalId: null, professionalName: null }));
    });

    it.each([
      ['weekday 0', { weekday: 0 }],
      ['weekday 8', { weekday: 8 }],
      ['weekday as string', { weekday: '1' }],
      ['bad startTime', { startTime: '25:00' }],
      ['startTime with seconds', { startTime: '19:00:00' }],
      ['duration below 15', { durationMinutes: 14 }],
      ['duration above 240', { durationMinutes: 241 }],
      ['capacity 0', { capacity: 0 }],
      ['capacity above 100', { capacity: 101 }],
      ['extreme capacity', { capacity: 1e20 }],
      ['extreme duration', { durationMinutes: 1e20 }],
      ['fractional capacity', { capacity: 1.5 }],
      ['unknown service', { service: 'yoga' }],
      ['bad professionalId', { professionalId: 'nope' }],
      ['unknown field', { active: false }],
    ])('rejects a create with %s', async (_label, override) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/templates').send({ ...baseTemplate(), ...override })
        .expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it.each([
      ['null startTime', { startTime: null }],
      ['null durationMinutes', { durationMinutes: null }],
      ['null capacity', { capacity: null }],
      ['null active', { active: null }],
      ['extreme capacity', { capacity: 1e20 }],
      ['bad startTime', { startTime: '7:00' }],
      ['duration below 15', { durationMinutes: 5 }],
      ['service change', { service: 'recovery' }],
    ])('rejects a patch with %s', async (_label, body) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const created = await agent.post('/api/staff/schedule/templates').send(baseTemplate()).expect(201);
      await agent.patch(`/api/staff/schedule/templates/${created.body.id}`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('rejects a malformed template id', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.patch('/api/staff/schedule/templates/abc').send({ capacity: 3 }).expect(400).expect(expectCode('VALIDATION_FAILED'));
      await agent.delete('/api/staff/schedule/templates/abc').expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });

  describe('POST /staff/time-slots', () => {
    const body = (override: object = {}) => ({ service: 'recovery', date: tomorrow(), startTime: '08:30', durationMinutes: 45, capacity: 2, ...override });

    it('creates a one-off slot with zeroed counters', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const res = await agent.post('/api/staff/time-slots').send(body()).expect(201);
      const startsAt = businessDateTime(tomorrow(), '08:30');
      expect(res.body).toEqual({
        id: expect.any(String),
        service: 'recovery',
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 45 * 60_000).toISOString(),
        capacity: 2,
        professional: null,
        cancelledAt: null,
        booked: 0, present: 0, absent: 0, noShow: 0, cancelled: 0, pendingAttendance: 0,
      });
      const [row] = await ctx.dataSource.query(`SELECT template_id FROM time_slots WHERE id = $1`, [res.body.id]);
      expect(row.template_id).toBeNull();
    });

    it('applies the rehab rules and checks the professional', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const pro = await createProfessional(agent);
      await agent.post('/api/staff/time-slots').send(body({ service: 'rehab', capacity: 1 })).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.post('/api/staff/time-slots').send(body({ service: 'rehab', capacity: 2, professionalId: pro })).expect(400).expect(expectCode('TEMPLATE_INVALID'));
      await agent.post('/api/staff/time-slots').send(body({ professionalId: '11111111-1111-4111-8111-111111111111' }))
        .expect(404).expect(expectCode('PROFESSIONAL_NOT_FOUND'));
      const ok = await agent.post('/api/staff/time-slots').send(body({ service: 'rehab', capacity: 1, professionalId: pro })).expect(201);
      expect(ok.body).toMatchObject({ service: 'rehab', capacity: 1, professional: { id: pro, name: 'Fisio Uno' } });
    });

    it.each([
      ['impossible date', { date: '2026-02-30' }],
      ['date-time instead of date', { date: '2026-10-20T10:00:00Z' }],
      ['year 0000', { date: '0000-01-01' }],
      ['date as number', { date: 20261020 }],
      ['bad startTime', { startTime: '24:00' }],
      ['duration above 240', { durationMinutes: 600 }],
      ['extreme duration', { durationMinutes: 1e20 }],
      ['capacity above 100', { capacity: 500 }],
      ['extreme capacity', { capacity: 1e20 }],
      ['unknown service', { service: 'yoga' }],
      ['missing date', { date: undefined }],
    ])('rejects %s', async (_label, override) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/time-slots').send(body(override)).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });
  });

  describe('POST /staff/schedule/generate', () => {
    it.each([[0], [61], [1e20], [1.5], ['7'], [null]])('rejects days = %s', async (days) => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/generate').send({ days }).expect(400).expect(expectCode('VALIDATION_FAILED'));
    });

    it('answers created 0 while another run holds the job lock', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/templates').send({ service: 'performance', weekday: isoWeekday(tomorrow()), startTime: '19:00', durationMinutes: 60, capacity: 14 }).expect(201);
      const before = await countSlots();

      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const holder = ctx.app.get(JobRunner).run('generate-slots', async () => { await gate; return {}; }, { force: true });
      await new Promise((resolve) => setTimeout(resolve, 100));
      await agent.post('/api/staff/schedule/generate').send({ days: 60 }).expect(201).expect((r) => expect(r.body).toEqual({ created: 0 }));
      expect(await countSlots()).toBe(before);
      release();
      await holder;
      const free = await agent.post('/api/staff/schedule/generate').send({ days: 60 }).expect(201);
      expect(free.body.created).toBeGreaterThan(0);
    });
  });

  describe('ScheduleService', () => {
    let schedule: ScheduleService;
    beforeAll(() => { schedule = ctx.app.get(ScheduleService); });

    const createSlot = async (agent: TestAgent, override: object = {}): Promise<string> => {
      const res = await agent.post('/api/staff/time-slots')
        .send({ service: 'performance', date: tomorrow(), startTime: '19:00', durationMinutes: 60, capacity: 14, ...override }).expect(201);
      return res.body.id as string;
    };

    it('lockSlot blocks a second transaction until the first one ends', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const slotId = await createSlot(agent);
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      let firstLocked: () => void = () => undefined;
      const locked = new Promise<void>((resolve) => { firstLocked = resolve; });

      const first = ctx.dataSource.transaction(async (m) => { await schedule.lockSlot(m, slotId); firstLocked(); await gate; });
      await locked;
      let secondDone = false;
      const second = ctx.dataSource.transaction((m) => schedule.lockSlot(m, slotId)).then(() => { secondDone = true; });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(secondDone).toBe(false);
      release();
      await Promise.all([first, second]);
      expect(secondDone).toBe(true);
    });

    it('getSlot returns the model with its professional or SLOT_NOT_FOUND', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const pro = await createProfessional(agent);
      const slotId = await createSlot(agent, { service: 'rehab', capacity: 1, professionalId: pro });
      expect(await schedule.getSlot(slotId)).toMatchObject({ id: slotId, service: 'rehab', professional: { id: pro, name: 'Fisio Uno' }, templateId: null, cancelledAt: null });
      await expect(schedule.getSlot('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
    });

    it('listSlots filters by service and range (both ends inclusive) and hides cancelled slots by default', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const day = tomorrow();
      const early = await createSlot(agent, { date: day, startTime: '07:00' });
      const late = await createSlot(agent, { date: day, startTime: '21:00' });
      await createSlot(agent, { date: day, startTime: '08:00', service: 'recovery', capacity: 2 });
      await createSlot(agent, { date: addDays(day, 1), startTime: '07:00' });
      await ctx.dataSource.transaction((m) => schedule.cancelSlot(m, late));

      const range = { from: businessDayStart(day), to: businessDayEnd(day) };
      expect((await schedule.listSlots({ ...range, service: 'performance' })).map((s) => s.id)).toEqual([early]);
      expect((await schedule.listSlots({ ...range, service: 'performance', includeCancelled: true })).map((s) => s.id)).toEqual([early, late]);
      expect(await schedule.listSlots(range)).toHaveLength(2);
      const exact = businessDateTime(day, '07:00');
      expect((await schedule.listSlots({ service: 'performance', from: exact, to: exact })).map((s) => s.id)).toEqual([early]);
    });

    it('cancelSlot marks the slot as cancelled once and keeps the first timestamp', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const slotId = await createSlot(agent);
      const first = await ctx.dataSource.transaction((m) => schedule.cancelSlot(m, slotId));
      expect(first.cancelledAt).toBeInstanceOf(Date);
      const second = await ctx.dataSource.transaction((m) => schedule.cancelSlot(m, slotId));
      expect(second.cancelledAt?.getTime()).toBe(first.cancelledAt?.getTime());
      await expect(ctx.dataSource.transaction((m) => schedule.cancelSlot(m, '00000000-0000-0000-0000-000000000000')))
        .rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
    });

    it('updateCapacity changes the capacity, but rehab slots only hold 1', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      const pro = await createProfessional(agent);
      const performance = await createSlot(agent);
      const rehab = await createSlot(agent, { service: 'rehab', capacity: 1, professionalId: pro });

      expect((await ctx.dataSource.transaction((m) => schedule.updateCapacity(m, performance, 20))).capacity).toBe(20);
      expect((await schedule.getSlot(performance)).capacity).toBe(20);
      await expect(ctx.dataSource.transaction((m) => schedule.updateCapacity(m, rehab, 2))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
      expect((await ctx.dataSource.transaction((m) => schedule.updateCapacity(m, rehab, 1))).capacity).toBe(1);
      await expect(ctx.dataSource.transaction((m) => schedule.updateCapacity(m, performance, 0))).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
      await expect(ctx.dataSource.transaction((m) => schedule.updateCapacity(m, '00000000-0000-0000-0000-000000000000', 5)))
        .rejects.toMatchObject({ code: 'SLOT_NOT_FOUND' });
    });

    it('generateSlots only creates future slots', async () => {
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/schedule/templates').send({ service: 'performance', weekday: isoWeekday(addDays(businessToday(), -3)), startTime: '19:00', durationMinutes: 60, capacity: 14 }).expect(201);
      await ctx.dataSource.query(`DELETE FROM time_slots`);
      await schedule.generateSlots(addDays(businessToday(), -10), 10);
      expect(await countSlots()).toBe(0);
    });
  });
});
