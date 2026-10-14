import { SchedulerRegistry } from '@nestjs/schedule';
import request from 'supertest';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import type { Service } from '../src/modules/catalog/entities/plan.entity.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createProfessional, createSlot } from './utils/fixtures.js';

type Status = 'confirmed' | 'cancelled' | 'pending_payment';

const CAPACITY: Record<Service, number> = { performance: 14, recovery: 2, rehab: 1 };

describe('booking reminders (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); await seedCatalogAndSchedule(ctx.dataSource); });

  const today = () => businessToday();
  const tomorrow = () => addDays(today(), 1);

  const book = async (input: { userId: string; service: Service; date: string; time: string; status?: Status }) => {
    const professionalId = input.service === 'rehab' ? await createProfessional(ctx.dataSource) : undefined;
    const slotId = await createSlot(ctx.dataSource, {
      service: input.service, startsAt: businessDateTime(input.date, input.time), capacity: CAPACITY[input.service], professionalId,
    });
    const [row] = await ctx.dataSource.query(
      `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at, cancelled_at)
       VALUES ($1, $2, $3, $4, now(), CASE WHEN $3 = 'cancelled' THEN now() END) RETURNING id`,
      [input.userId, slotId, input.status ?? 'confirmed', input.service === 'performance' ? 'plan' : 'package'],
    );
    return row.id as string;
  };

  const reminders = (): Promise<{ userId: string; key: string; template: string }[]> =>
    ctx.dataSource.query(
      `SELECT user_id AS "userId", idempotency_key AS key, template FROM email_logs WHERE template = 'booking-reminder' ORDER BY idempotency_key`,
    );
  const run = (staff: { agent: ReturnType<typeof request.agent> }) => staff.agent.post('/api/staff/automations/run/booking-reminders');

  // Brevo runs in dry-run here (no API key): every reminder is logged but none counts as `sent` (T-060 M-4).
  it('sends one reminder per Rehab and Recovery booking of tomorrow, and not a second time', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const ana = await signUpClient(ctx.app);
    const beto = await signUpClient(ctx.app);
    const recovery = await book({ userId: ana.userId, service: 'recovery', date: tomorrow(), time: '10:00' });
    const rehab = await book({ userId: beto.userId, service: 'rehab', date: tomorrow(), time: '16:00' });

    const first = await run(staff).expect(200);
    expect(first.body).toEqual({ job: 'booking-reminders', ran: true, result: { sent: 0, skipped: 2 } });
    expect(await reminders()).toEqual(
      [
        { userId: ana.userId, key: `booking-reminder:${recovery}`, template: 'booking-reminder' },
        { userId: beto.userId, key: `booking-reminder:${rehab}`, template: 'booking-reminder' },
      ].sort((a, b) => a.key.localeCompare(b.key)),
    );

    const second = await run(staff).expect(200);
    expect(second.body).toEqual({ job: 'booking-reminders', ran: true, result: { sent: 0, skipped: 2 } });
    expect(await reminders()).toHaveLength(2);
  });

  it('leaves out Performance, cancelled and unpaid bookings and any day other than tomorrow', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const { userId } = await signUpClient(ctx.app);
    const included = await book({ userId, service: 'recovery', date: tomorrow(), time: '09:00' });
    await book({ userId, service: 'performance', date: tomorrow(), time: '19:00' });
    await book({ userId, service: 'recovery', date: tomorrow(), time: '10:00', status: 'cancelled' });
    await book({ userId, service: 'recovery', date: tomorrow(), time: '11:00', status: 'pending_payment' });
    await book({ userId, service: 'recovery', date: today(), time: '23:30' });
    await book({ userId, service: 'rehab', date: addDays(today(), 2), time: '00:00' });

    const res = await run(staff).expect(200);
    expect(res.body.result).toEqual({ sent: 0, skipped: 1 });
    expect((await reminders()).map((r) => r.key)).toEqual([`booking-reminder:${included}`]);
  });

  it('covers the whole business day: 00:00 and 23:30 of tomorrow in Montevideo', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const { userId } = await signUpClient(ctx.app);
    const early = await book({ userId, service: 'recovery', date: tomorrow(), time: '00:00' });
    const late = await book({ userId, service: 'rehab', date: tomorrow(), time: '23:30' });
    await run(staff).expect(200);
    expect((await reminders()).map((r) => r.key).sort()).toEqual([`booking-reminder:${early}`, `booking-reminder:${late}`].sort());
  });

  it('reminds clients on pause too (transactional email, D93)', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const paused = await signUpClient(ctx.app);
    await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`).send({ reason: 'injury' }).expect(201);
    const bookingId = await book({ userId: paused.userId, service: 'rehab', date: tomorrow(), time: '10:00' });

    const res = await run(staff).expect(200);
    expect(res.body.result).toEqual({ sent: 0, skipped: 1 });
    expect(await reminders()).toEqual([{ userId: paused.userId, key: `booking-reminder:${bookingId}`, template: 'booking-reminder' }]);
  });

  it('does nothing when there is nothing to remind', async () => {
    const staff = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await run(staff).expect(200);
    expect(res.body).toEqual({ job: 'booking-reminders', ran: true, result: { sent: 0, skipped: 0 } });
    expect(await ctx.dataSource.query(`SELECT 1 FROM email_logs`)).toHaveLength(0);
  });

  it('is a staff-only endpoint', async () => {
    const client = await signUp(ctx.app);
    await client.agent.post('/api/staff/automations/run/booking-reminders').expect(403);
    await request(ctx.app.getHttpServer()).post('/api/staff/automations/run/booking-reminders').expect(401);
  });

  it('registers the cron at 18:00 Montevideo', () => {
    const job = ctx.app.get(SchedulerRegistry).getCronJobs().get('booking-reminders');
    expect(job && { expression: job.cronTime.source, timeZone: job.cronTime.timeZone })
      .toEqual({ expression: '0 18 * * *', timeZone: 'America/Montevideo' });
  });
});
