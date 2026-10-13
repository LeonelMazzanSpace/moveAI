import request from 'supertest';
import type { DataSource } from 'typeorm';
import { addDays, businessDateTime, businessMonth, businessToday } from '../src/common/time/business-time.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { AlertsService } from '../src/modules/followup/services/alerts.service.js';
import { InactivityService } from '../src/modules/followup/services/inactivity.service.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUp, signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb } from './utils/db.js';
import { createSlot, givePerformancePlan } from './utils/fixtures.js';

// A confirmed Performance booking at 19:00 local of `date`, with a `present` attendance marked by `staffId`.
async function attend(ds: DataSource, userId: string, staffId: string, date: string): Promise<void> {
  const slotId = await createSlot(ds, { service: 'performance', startsAt: businessDateTime(date, '19:00'), capacity: 14 });
  const [booking] = await ds.query(
    `INSERT INTO bookings (user_id, time_slot_id, status, source, confirmed_at) VALUES ($1, $2, 'confirmed', 'plan', now()) RETURNING id`,
    [userId, slotId],
  );
  await ds.query(
    `INSERT INTO attendances (booking_id, status, marked_by, marked_at) VALUES ($1, 'present', $2, now())`,
    [booking.id, staffId],
  );
}

const ZERO_COUNTS = {
  expiring: 0, expired: 0, no_attendance: 0, prolonged_inactivity: 0, frequency_drop: 0, recontact: 0,
  checkin_pain: 0, checkin_goals: 0,
};

describe('follow-up alerts (e2e)', () => {
  let ctx: TestApp;
  let alerts: AlertsService;
  let staff: { agent: TestAgent; userId: string };
  beforeAll(async () => {
    ctx = await createTestApp();
    alerts = ctx.app.get(AlertsService);
  });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => {
    await resetDb(ctx.dataSource);
    await seedCatalogAndSchedule(ctx.dataSource);
    staff = await signUpStaff(ctx.app, ctx.dataSource);
  });

  const today = () => businessToday();
  const expectCode = (code: string) => (r: { body: { code: string } }) => expect(r.body.code).toBe(code);
  const alertRows = () => ctx.dataSource.query(`SELECT user_id AS "userId", type, period_key AS "periodKey", status FROM followup_alerts ORDER BY type`);

  it('creates an expiring alert once, even when detection runs twice the same day', async () => {
    const client = await signUp(ctx.app, { name: 'Martina Suárez' });
    const subId = await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -2), endsOn: addDays(today(), 3) });

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, expiring: 1 });
    expect(await alerts.detectAlerts(today())).toEqual(ZERO_COUNTS);
    expect(await alertRows()).toEqual([{ userId: client.userId, type: 'expiring', periodKey: `sub:${subId}`, status: 'open' }]);

    const counts = await staff.agent.get('/api/staff/alerts/counts').expect(200);
    expect(counts.body).toEqual({ ...ZERO_COUNTS, expiring: 1, total: 1 });

    const list = await staff.agent.get('/api/staff/alerts').expect(200);
    expect(list.body).toEqual([{
      id: expect.any(String), type: 'expiring', status: 'open',
      client: { id: client.userId, name: 'Martina Suárez', initials: 'MS' },
      planName: 'Plan Mensual', endsOn: addDays(today(), 3), lastAttendanceOn: null, frequencyPerWeek: 0,
      usualFrequencyPerWeek: null, contactsCount: 0, pause: null, checkin: null, createdAt: expect.any(String),
    }]);
  });

  it('raises no_attendance ten days after the last attendance', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 30) });
    const lastOn = addDays(today(), -10);
    await attend(ctx.dataSource, client.userId, staff.userId, lastOn);

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, no_attendance: 1 });
    expect(await alertRows()).toEqual([{ userId: client.userId, type: 'no_attendance', periodKey: `since:${lastOn}`, status: 'open' }]);
    const [alert] = (await staff.agent.get('/api/staff/alerts?type=no_attendance').expect(200)).body;
    expect(alert).toMatchObject({ type: 'no_attendance', lastAttendanceOn: lastOn, frequencyPerWeek: 0.3, endsOn: addDays(today(), 30) });
  });

  it('raises prolonged inactivity instead of no_attendance after 21 days', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), 30) });
    await attend(ctx.dataSource, client.userId, staff.userId, addDays(today(), -25));

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, prolonged_inactivity: 1 });
  });

  it('raises a monthly frequency drop from the R10 windows', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -90), endsOn: addDays(today(), 30) });
    // Baseline: 2 per week during the 8 weeks before the last 2 weeks; recent: a single attendance yesterday.
    for (let week = 0; week < 8; week += 1) {
      await attend(ctx.dataSource, client.userId, staff.userId, addDays(today(), -(15 + week * 7)));
      await attend(ctx.dataSource, client.userId, staff.userId, addDays(today(), -(17 + week * 7)));
    }
    await attend(ctx.dataSource, client.userId, staff.userId, addDays(today(), -1));

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, frequency_drop: 1 });
    expect(await alertRows()).toEqual([
      { userId: client.userId, type: 'frequency_drop', periodKey: `month:${businessMonth(today())}`, status: 'open' },
    ]);
    const [alert] = (await staff.agent.get('/api/staff/alerts?type=frequency_drop').expect(200)).body;
    expect(alert.usualFrequencyPerWeek).toBe(2);
  });

  it('raises expired for a plan that ended recently without renewal', async () => {
    const client = await signUpClient(ctx.app);
    const subId = await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), -5) });
    const old = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, old.userId, { startsOn: addDays(today(), -80), endsOn: addDays(today(), -31) });
    await signUpClient(ctx.app);

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, expired: 1 });
    expect(await alertRows()).toEqual([{ userId: client.userId, type: 'expired', periodKey: `sub:${subId}`, status: 'open' }]);
  });

  it('only raises recontact for a paused client, on its recontact date', async () => {
    const client = await signUpClient(ctx.app);
    // Would raise expiring and no_attendance if it were not paused.
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
    const later = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, later.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });

    const pause = await staff.agent.post(`/api/staff/clients/${client.userId}/inactivity-reasons`)
      .send({ reason: 'injury', recontactOn: today() }).expect(201);
    await staff.agent.post(`/api/staff/clients/${later.userId}/inactivity-reasons`)
      .send({ reason: 'vacation', recontactOn: addDays(today(), 1) }).expect(201);

    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, recontact: 1 });
    expect(await alerts.detectAlerts(today())).toEqual(ZERO_COUNTS);
    expect(await alertRows()).toEqual([{ userId: client.userId, type: 'recontact', periodKey: `reason:${pause.body.id}`, status: 'open' }]);

    const [alert] = (await staff.agent.get('/api/staff/alerts').expect(200)).body;
    expect(alert.pause).toEqual({ reason: 'injury', since: pause.body.startedAt, recontactOn: today() });

    expect(await alerts.detectAlerts(addDays(today(), 1))).toEqual({ ...ZERO_COUNTS, recontact: 1 });
  });

  it('skips a client paused after detection read the pauses, except for recontact', async () => {
    const paused = await signUpClient(ctx.app);
    const active = await signUpClient(ctx.app);
    // Both would raise expiring and no_attendance if they were not paused.
    for (const client of [paused, active]) {
      await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -20), endsOn: addDays(today(), 3) });
    }
    const pause = await staff.agent.post(`/api/staff/clients/${paused.userId}/inactivity-reasons`)
      .send({ reason: 'injury', recontactOn: today() }).expect(201);

    // The pause opens between the read of active pauses and the insert: detection sees no pause at all.
    const inactivity = ctx.app.get(InactivityService);
    const stub = vi.spyOn(inactivity, 'getActivePauses').mockResolvedValue(new Map());
    try {
      expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, expiring: 1, no_attendance: 1 });
    } finally {
      stub.mockRestore();
    }
    expect((await alertRows()).map((r: { userId: string; type: string }) => [r.userId, r.type])).toEqual([
      [active.userId, 'expiring'], [active.userId, 'no_attendance'],
    ]);

    // The recontact alert of the paused client still goes through the insert.
    expect(await alerts.detectAlerts(today())).toEqual({ ...ZERO_COUNTS, recontact: 1 });
    expect(await ctx.dataSource.query(`SELECT type, period_key AS "periodKey" FROM followup_alerts WHERE user_id = $1`, [paused.userId]))
      .toEqual([{ type: 'recontact', periodKey: `reason:${pause.body.id}` }]);
  });

  it('records contacts against the alert and its client', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -2), endsOn: addDays(today(), 3) });
    await alerts.detectAlerts(today());
    const [alert] = (await staff.agent.get('/api/staff/alerts').expect(200)).body;

    const contact = await staff.agent.post(`/api/staff/alerts/${alert.id}/contacts`)
      .send({ channel: 'whatsapp', outcome: 'reached', note: '  Renueva el lunes  ' }).expect(201);
    expect(contact.body).toEqual({
      id: expect.any(String), channel: 'whatsapp', outcome: 'reached', note: 'Renueva el lunes',
      staffName: 'Usuario Test', alertType: 'expiring', createdAt: expect.any(String),
    });
    await staff.agent.post(`/api/staff/alerts/${alert.id}/contacts`).send({ channel: 'phone', outcome: 'no_answer' }).expect(201)
      .expect((r) => expect(r.body.note).toBeNull());

    const [listed] = (await staff.agent.get('/api/staff/alerts').expect(200)).body;
    expect(listed.contactsCount).toBe(2);
    const rows = await ctx.dataSource.query(
      `SELECT user_id AS "userId", alert_id AS "alertId", staff_id AS "staffId" FROM followup_contacts`,
    );
    expect(rows).toEqual([
      { userId: client.userId, alertId: alert.id, staffId: staff.userId },
      { userId: client.userId, alertId: alert.id, staffId: staff.userId },
    ]);
  });

  it('validates contacts and rejects unknown alerts', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -2), endsOn: addDays(today(), 3) });
    await alerts.detectAlerts(today());
    const [alert] = (await staff.agent.get('/api/staff/alerts').expect(200)).body;

    for (const body of [
      {}, { channel: 'sms', outcome: 'reached' }, { channel: 'phone', outcome: 'maybe' }, { channel: 'phone', outcome: 'reached', note: null },
      { channel: 'phone', outcome: 'reached', note: 'x'.repeat(1001) }, { channel: 'phone', outcome: 'reached', note: 'a\u0000b' },
      { channel: 'phone', outcome: 'reached', extra: 1 },
    ]) {
      await staff.agent.post(`/api/staff/alerts/${alert.id}/contacts`).send(body).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
    await staff.agent.post('/api/staff/alerts/11111111-1111-4111-8111-111111111111/contacts')
      .send({ channel: 'phone', outcome: 'reached' }).expect(404).expect(expectCode('ALERT_NOT_FOUND'));
    await staff.agent.post('/api/staff/alerts/not-a-uuid/contacts')
      .send({ channel: 'phone', outcome: 'reached' }).expect(400).expect(expectCode('VALIDATION_FAILED'));
  });

  it('handles an alert once', async () => {
    const client = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, client.userId, { startsOn: addDays(today(), -2), endsOn: addDays(today(), 3) });
    await alerts.detectAlerts(today());
    const [alert] = (await staff.agent.get('/api/staff/alerts').expect(200)).body;

    const handled = await staff.agent.post(`/api/staff/alerts/${alert.id}/handle`).expect(200);
    expect(handled.body).toMatchObject({ id: alert.id, status: 'handled', type: 'expiring' });
    await staff.agent.post(`/api/staff/alerts/${alert.id}/handle`).expect(409).expect(expectCode('ALERT_ALREADY_HANDLED'));
    await staff.agent.post('/api/staff/alerts/11111111-1111-4111-8111-111111111111/handle').expect(404).expect(expectCode('ALERT_NOT_FOUND'));

    const [row] = await ctx.dataSource.query(`SELECT handled_by AS "handledBy", handled_at AS "handledAt" FROM followup_alerts`);
    expect(row.handledBy).toBe(staff.userId);
    expect(row.handledAt).toBeInstanceOf(Date);

    expect((await staff.agent.get('/api/staff/alerts').expect(200)).body).toEqual([]);
    expect((await staff.agent.get('/api/staff/alerts?status=handled').expect(200)).body).toHaveLength(1);
    expect((await staff.agent.get('/api/staff/alerts/counts').expect(200)).body.total).toBe(0);
    // Handled alerts are not raised again for the same period.
    expect(await alerts.detectAlerts(today())).toEqual(ZERO_COUNTS);
  });

  it('filters by type and validates the list query', async () => {
    const a = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, a.userId, { startsOn: addDays(today(), -2), endsOn: addDays(today(), 3) });
    const b = await signUpClient(ctx.app);
    await givePerformancePlan(ctx.dataSource, b.userId, { startsOn: addDays(today(), -40), endsOn: addDays(today(), -5) });
    await alerts.detectAlerts(today());

    expect((await staff.agent.get('/api/staff/alerts').expect(200)).body).toHaveLength(2);
    const expired = (await staff.agent.get('/api/staff/alerts?type=expired').expect(200)).body;
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({ type: 'expired', planName: 'Plan Mensual', endsOn: addDays(today(), -5) });
    for (const query of ['type=late', 'status=closed', 'status=', 'page=1']) {
      await staff.agent.get(`/api/staff/alerts?${query}`).expect(400).expect(expectCode('VALIDATION_FAILED'));
    }
  });

  it('is staff only', async () => {
    const client = await signUpClient(ctx.app);
    await client.agent.get('/api/staff/alerts').expect(403).expect(expectCode('FORBIDDEN'));
    await client.agent.get('/api/staff/alerts/counts').expect(403).expect(expectCode('FORBIDDEN'));
    await client.agent.post('/api/staff/alerts/11111111-1111-4111-8111-111111111111/handle').expect(403);
    await request(ctx.app.getHttpServer()).get('/api/staff/alerts').expect(401).expect(expectCode('UNAUTHENTICATED'));
  });
});
