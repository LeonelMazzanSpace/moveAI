import request from 'supertest';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot } from './utils/fixtures.js';

describe('availability (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
  const day = (offset: number) => addDays(businessToday(), offset);

  it('sums free spots of future bookable slots per day', async () => {
    const pro = await createProfessional(ctx.dataSource);
    const rehab = (date: string, time: string) =>
      createSlot(ctx.dataSource, { service: 'rehab', startsAt: businessDateTime(date, time), capacity: 1, professionalId: pro });
    await rehab(day(1), '09:00');
    await rehab(day(1), '10:00');
    const booked = await rehab(day(1), '11:00');
    const cancelled = await rehab(day(2), '09:00');
    await rehab(day(3), '14:00');
    await rehab(day(8), '09:00'); // outside the 7 requested days
    await createSlot(ctx.dataSource, { service: 'rehab', startsAt: new Date(Date.now() - 60_000), capacity: 1, professionalId: pro }); // already started
    await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(day(1), '17:00'), capacity: 2 }); // other service
    await ctx.dataSource.query(`UPDATE time_slots SET cancelled_at = now() WHERE id = $1`, [cancelled]);
    const { userId } = await signUpClient(ctx.app);
    await ctx.dataSource.query(`INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, 'confirmed', 'followup')`, [userId, booked]);

    const res = await request(ctx.app.getHttpServer()).get(`/api/schedule/availability?service=rehab&from=${day(0)}&days=7`).expect(200);
    expect(res.body).toEqual([
      { date: day(0), available: 0 },
      { date: day(1), available: 2 },
      { date: day(2), available: 0 },
      { date: day(3), available: 1 },
      { date: day(4), available: 0 },
      { date: day(5), available: 0 },
      { date: day(6), available: 0 },
    ]);
  });

  it('ignores slots beyond the booking window and defaults to 7 days', async () => {
    await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(day(14), '17:00'), capacity: 2 });
    await createSlot(ctx.dataSource, { service: 'recovery', startsAt: businessDateTime(day(15), '17:00'), capacity: 2 });
    const res = await request(ctx.app.getHttpServer()).get(`/api/schedule/availability?service=recovery&from=${day(14)}`).expect(200);
    expect(res.body).toHaveLength(7);
    expect(res.body.slice(0, 2)).toEqual([{ date: day(14), available: 2 }, { date: day(15), available: 0 }]);
  });

  it('lists a 23:30 local slot under its local date, not the next UTC day', async () => {
    const startsAt = businessDateTime(day(1), '23:30');
    expect(startsAt.toISOString()).toBe(`${day(2)}T02:30:00.000Z`);
    const slotId = await createSlot(ctx.dataSource, { service: 'performance', startsAt, capacity: 14 });
    const anon = request(ctx.app.getHttpServer());
    const ids = (body: { id: string }[]) => body.map((s) => s.id);

    expect(ids((await anon.get(`/api/schedule/time-slots?service=performance&date=${day(1)}`).expect(200)).body)).toEqual([slotId]);
    expect(ids((await anon.get(`/api/schedule/time-slots?service=performance&date=${day(2)}`).expect(200)).body)).toEqual([]);

    const { agent: staff } = await signUpStaff(ctx.app, ctx.dataSource);
    expect(ids((await staff.get(`/api/staff/time-slots?date=${day(1)}`).expect(200)).body)).toEqual([slotId]);
    expect(ids((await staff.get(`/api/staff/time-slots?date=${day(2)}`).expect(200)).body)).toEqual([]);

    const availability = await anon.get(`/api/schedule/availability?service=performance&from=${day(1)}&days=2`).expect(200);
    expect(availability.body).toEqual([{ date: day(1), available: 14 }, { date: day(2), available: 0 }]);
  });

  it.each([
    ['days above 31', 'service=rehab&from=2026-10-13&days=32'],
    ['days below 1', 'service=rehab&from=2026-10-13&days=0'],
    ['huge days', 'service=rehab&from=2026-10-13&days=1e20'],
    ['invalid date', 'service=rehab&from=2026-02-30'],
    ['missing from', 'service=rehab'],
    ['unknown service', 'service=yoga&from=2026-10-13'],
  ])('rejects %s', async (_label, query) => {
    await request(ctx.app.getHttpServer()).get(`/api/schedule/availability?${query}`).expect(400).expect(expectCode('VALIDATION_FAILED'));
  });
});
