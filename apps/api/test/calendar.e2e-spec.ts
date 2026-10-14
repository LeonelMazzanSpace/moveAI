import { randomBytes } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getOptionsToken } from '@nestjs/throttler';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDays, businessDateTime, businessToday } from '../src/common/time/business-time.js';
import { validate } from '../src/config/env.validation.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { OAUTH_STATE_TTL_MS, signState } from '../src/modules/calendar/domain/oauth-state.js';
import { decryptToken } from '../src/modules/calendar/domain/token-cipher.js';
import { CalendarPushJob } from '../src/modules/calendar/jobs/calendar-push.job.js';
import { CalendarConnectionService } from '../src/modules/calendar/services/calendar-connection.service.js';
import { GoogleCalendarService } from '../src/modules/calendar/services/google-calendar.service.js';
import { createTestApp, raisedCheckoutLimit } from './utils/app.js';
import { signUp, signUpClient, signUpStaff, type TestAgent } from './utils/auth.js';
import { resetDb, waitForLockWaiters } from './utils/db.js';
import { FakeGoogleCalendar } from './utils/fake-google-calendar.js';
import { createProfessional, createSlot, planIdBySlug } from './utils/fixtures.js';

const CALENDAR = 'rehab@group.calendar.google.com';
const STAFF_INBOX = 'avisos@move.test';
const CALLBACK = '/api/calendar/oauth/callback';
const CONFIG_URL = `${process.env.WEB_URL}/staff/configuracion?tab=calendario`;

const expectCode = (code: string) => (res: { body: { code?: string } }) => expect(res.body.code).toBe(code);
const tomorrow = () => addDays(businessToday(), 1);

describe('Google Calendar env (D94)', () => {
  const base = {
    NODE_ENV: 'test', PORT: '3001', WEB_URL: 'http://localhost:3000', API_PUBLIC_URL: 'http://localhost:3001',
    DB_HOST: 'localhost', DB_PORT: '5432', DB_USER: 'move', DB_PASSWORD: 'move', DB_NAME: 'move',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
  };

  it('accepts no key or a key of exactly 32 bytes in base64', () => {
    expect(() => validate(base)).not.toThrow();
    expect(() => validate({ ...base, CALENDAR_TOKEN_KEY: '' })).not.toThrow();
    expect(() => validate({ ...base, CALENDAR_TOKEN_KEY: randomBytes(32).toString('base64') })).not.toThrow();
  });

  it('refuses to start with a key of another length or encoding', () => {
    for (const key of [randomBytes(31).toString('base64'), randomBytes(33).toString('base64'), randomBytes(32).toString('hex'), 'short']) {
      expect(() => validate({ ...base, CALENDAR_TOKEN_KEY: key })).toThrow(/CALENDAR_TOKEN_KEY/);
    }
  });
});

describe('Google Calendar without configuration (e2e)', () => {
  it('answers CALENDAR_NOT_CONFIGURED and reports configured: false', async () => {
    const ctx = await createTestApp();
    try {
      await resetDb(ctx.dataSource);
      const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
      await agent.post('/api/staff/calendar/connect').expect(409).expect(expectCode('CALENDAR_NOT_CONFIGURED'));
      const status = await agent.get('/api/staff/calendar').expect(200);
      expect(status.body).toEqual({
        configured: false, status: 'disconnected', accountEmail: null, calendarId: null, calendarName: null, lastPushAt: null, lastPullAt: null,
      });
    } finally {
      await ctx.app.close();
    }
  });
});

describe('Google Calendar ↔ Rehab (e2e)', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let tokenKey: Buffer;
  const google = new FakeGoogleCalendar();

  beforeAll(async () => {
    tokenKey = randomBytes(32);
    process.env.GOOGLE_CLIENT_ID = 'test-client';
    process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
    process.env.CALENDAR_TOKEN_KEY = tokenKey.toString('base64');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GoogleCalendarService).useValue(google)
      .overrideProvider(getOptionsToken()).useValue(raisedCheckoutLimit)
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    ds = app.get(DataSource);
  });
  afterAll(async () => {
    await app.close();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.CALENDAR_TOKEN_KEY;
  });
  beforeEach(async () => {
    await resetDb(ds);
    await seedCatalogAndSchedule(ds);
    await ds.query(`UPDATE settings SET value = to_jsonb($1::text) WHERE key = 'staff_notifications_email'`, [STAFF_INBOX]);
    google.reset();
  });

  const count = async (sql: string, params: unknown[] = []): Promise<number> => {
    const [row] = await ds.query(`SELECT count(*)::int AS count FROM ${sql}`, params);
    return row.count as number;
  };
  const emails = (key: string) => count(`email_logs WHERE idempotency_key = $1`, [key]);
  const blockedAt = async (slotId: string): Promise<Date | null> => {
    const [row] = await ds.query(`SELECT calendar_blocked_at FROM time_slots WHERE id = $1`, [slotId]);
    return row.calendar_blocked_at as Date | null;
  };
  const stateOf = (authUrl: string): string => new URL(authUrl).searchParams.get('state') ?? '';

  const callback = (agent: TestAgent, query: Record<string, string>) =>
    agent.get(`${CALLBACK}?${new URLSearchParams(query).toString()}`).redirects(0);

  const startConnect = async (agent: TestAgent): Promise<string> => {
    const res = await agent.post('/api/staff/calendar/connect').expect(200);
    return stateOf(res.body.authUrl as string);
  };

  const connect = async (agent: TestAgent, code = 'abc'): Promise<void> => {
    const res = await callback(agent, { code, state: await startConnect(agent), scope: 'email openid', authuser: '0' }).expect(302);
    expect(res.headers.location).toBe(`${CONFIG_URL}&calendar=connected`);
  };

  const connectAndChoose = async (agent: TestAgent): Promise<void> => {
    await connect(agent);
    await agent.patch('/api/staff/calendar').send({ calendarId: CALENDAR }).expect(200);
  };

  const sync = (agent: TestAgent) => agent.post('/api/staff/calendar/sync').expect(200);

  const rehabSlot = async (time = '10:00'): Promise<string> => {
    const professionalId = await createProfessional(ds, 'Fisio Uno');
    return createSlot(ds, { service: 'rehab', startsAt: businessDateTime(tomorrow(), time), capacity: 1, professionalId });
  };

  const followupClient = async () => {
    const client = await signUp(app, { name: 'Ana Pérez' });
    await ds.query(`UPDATE users SET rehab_followup_enabled = true WHERE id = $1`, [client.userId]);
    return client;
  };

  const busyOver = (slotTime: string, minutes = 30) => {
    const start = businessDateTime(tomorrow(), slotTime);
    return google.addEvent(CALENDAR, new Date(start.getTime() + minutes * 60_000), new Date(start.getTime() + (minutes + 60) * 60_000));
  };

  describe('access', () => {
    it('answers 403 to clients and 401 without a session on every calendar endpoint', async () => {
      const { agent } = await signUpClient(app);
      const anonymous = request(app.getHttpServer());
      const calls: [string, string][] = [
        ['get', '/api/staff/calendar'], ['post', '/api/staff/calendar/connect'], ['get', '/api/staff/calendar/calendars'],
        ['patch', '/api/staff/calendar'], ['post', '/api/staff/calendar/sync'], ['delete', '/api/staff/calendar'],
        ['get', `${CALLBACK}?code=x&state=y`],
      ];
      for (const [method, path] of calls) {
        const asClient = method === 'patch' ? agent.patch(path).send({ calendarId: CALENDAR }) : agent[method as 'get'](path);
        await asClient.expect(403).expect(expectCode('FORBIDDEN'));
        await anonymous[method as 'get'](path).expect(401).expect(expectCode('UNAUTHENTICATED'));
      }
    });
  });

  describe('connection', () => {
    it('starts with a consent url carrying a signed state', async () => {
      const { agent } = await signUpStaff(app, ds);
      const res = await agent.post('/api/staff/calendar/connect').expect(200);
      expect(res.body.authUrl).toMatch(/^https:\/\/accounts\.google\.test\/auth\?state=/);
      expect(stateOf(res.body.authUrl as string).split('.')).toHaveLength(2);
    });

    it('stores nothing and redirects with calendar=error when the state is invalid, expired, altered or of another staff', async () => {
      const a = await signUpStaff(app, ds);
      const b = await signUpStaff(app, ds);
      const valid = await startConnect(a.agent);
      const [body, mac] = valid.split('.');
      const expired = signState({ staffId: a.userId, nonce: 'n', exp: Date.now() - 1 }, tokenKey);
      const otherKey = signState({ staffId: a.userId, nonce: 'n', exp: Date.now() + OAUTH_STATE_TTL_MS }, randomBytes(32));

      const attempts: [TestAgent, Record<string, string>][] = [
        [b.agent, { code: 'abc', state: valid }],
        [a.agent, { code: 'abc', state: expired }],
        [a.agent, { code: 'abc', state: otherKey }],
        [a.agent, { code: 'abc', state: `${body}.${mac.slice(1)}` }],
        [a.agent, { code: 'abc', state: 'garbage' }],
        [a.agent, { code: 'abc' }],
        [a.agent, { state: valid }],
        [a.agent, { error: 'access_denied', state: valid }],
      ];
      for (const [agent, query] of attempts) {
        const res = await callback(agent, query).expect(302);
        expect(res.headers.location).toBe(`${CONFIG_URL}&calendar=error`);
      }
      expect(await count('calendar_connections')).toBe(0);
      expect(google.refreshedWith).toEqual([]);
    });

    it('redirects with calendar=error and stores nothing when Google fails the exchange', async () => {
      const { agent } = await signUpStaff(app, ds);
      const state = await startConnect(agent);
      google.failWith('transient', 'exchangeCode');
      const res = await callback(agent, { code: 'abc', state }).expect(302);
      expect(res.headers.location).toBe(`${CONFIG_URL}&calendar=error`);
      expect(await count('calendar_connections')).toBe(0);
    });

    it('stores the refresh token encrypted and redirects with calendar=connected', async () => {
      const { agent, userId } = await signUpStaff(app, ds);
      await connect(agent, 'abc');

      const [row] = await ds.query(`SELECT refresh_token_enc, status, google_account_email, connected_by FROM calendar_connections`);
      expect(row.refresh_token_enc).not.toContain('1//refresh-abc');
      expect(row.refresh_token_enc).not.toContain('refresh');
      expect(decryptToken(row.refresh_token_enc as string, tokenKey)).toBe('1//refresh-abc');
      expect(row).toMatchObject({ status: 'connected', google_account_email: 'agenda@move.test', connected_by: userId });

      const status = await agent.get('/api/staff/calendar').expect(200);
      expect(status.body).toEqual({
        configured: true, status: 'connected', accountEmail: 'agenda@move.test', calendarId: null, calendarName: null,
        lastPushAt: null, lastPullAt: null,
      });
    });

    it('lists writable calendars and only accepts one of them', async () => {
      const { agent } = await signUpStaff(app, ds);
      await agent.get('/api/staff/calendar/calendars').expect(409).expect(expectCode('CALENDAR_NOT_CONNECTED'));
      await agent.patch('/api/staff/calendar').send({ calendarId: CALENDAR }).expect(409).expect(expectCode('CALENDAR_NOT_CONNECTED'));
      await connect(agent);

      const list = await agent.get('/api/staff/calendar/calendars').expect(200);
      expect(list.body).toEqual([
        { id: CALENDAR, name: 'Rehab MOVE', primary: false },
        { id: 'agenda@move.test', name: 'Agenda', primary: true },
      ]);
      await agent.patch('/api/staff/calendar').send({ calendarId: 'someone-else@group.calendar.google.com' })
        .expect(400).expect(expectCode('CALENDAR_INVALID_CALENDAR'));
      for (const calendarId of ['', '   ', null, 42, 'a\u0000b', '\ud800']) {
        await agent.patch('/api/staff/calendar').send({ calendarId }).expect(400).expect(expectCode('VALIDATION_FAILED'));
      }
      await agent.patch('/api/staff/calendar').send({}).expect(400).expect(expectCode('VALIDATION_FAILED'));

      const chosen = await agent.patch('/api/staff/calendar').send({ calendarId: ` ${CALENDAR} ` }).expect(200);
      expect(chosen.body).toMatchObject({ status: 'connected', calendarId: CALENDAR, calendarName: 'Rehab MOVE' });
    });

    it('answers CALENDAR_PROVIDER_ERROR when Google fails listing calendars', async () => {
      const { agent } = await signUpStaff(app, ds);
      await connect(agent);
      google.failWith('transient', 'listCalendars');
      await agent.get('/api/staff/calendar/calendars').expect(502).expect(expectCode('CALENDAR_PROVIDER_ERROR'));
    });
  });

  describe('MOVE → Google (push)', () => {
    it('creates one event per confirmed Rehab booking, never twice, and deletes it when the booking is cancelled', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot();
      const client = await followupClient();
      const booking = await client.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      const bookingId = booking.body.id as string;
      const eventId = `move${bookingId.replaceAll('-', '')}`;

      const status = await sync(staff.agent);
      expect(status.body.lastPushAt).not.toBeNull();
      expect(status.body.lastPullAt).not.toBeNull();
      const event = google.calendarEvents(CALENDAR).get(eventId);
      expect(event).toMatchObject({
        summary: 'Rehab · Seguimiento — Ana Pérez',
        description: 'Profesional: Fisio Uno\nReserva creada desde MOVE',
        extendedProperties: { private: { moveBookingId: bookingId } },
      });
      expect(await count(`calendar_event_links WHERE booking_id = $1 AND google_event_id = $2`, [bookingId, eventId])).toBe(1);
      // MOVE's own event never blocks its slot.
      expect(await blockedAt(slotId)).toBeNull();

      await sync(staff.agent);
      expect(google.inserted).toEqual([eventId]);

      await staff.agent.post(`/api/staff/bookings/${bookingId}/cancel`).expect(200);
      await sync(staff.agent);
      expect(google.calendarEvents(CALENDAR).has(eventId)).toBe(false);
      expect(await count('calendar_event_links')).toBe(0);
    });

    it('restores a lost link from the existing event instead of creating a second one', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const client = await followupClient();
      const booking = await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot() }).expect(201);
      await sync(staff.agent);
      await ds.query(`DELETE FROM calendar_event_links`);

      await sync(staff.agent);
      expect(google.inserted).toHaveLength(1);
      expect(google.calendarEvents(CALENDAR).size).toBe(1);
      expect(await count(`calendar_event_links WHERE booking_id = $1`, [booking.body.id])).toBe(1);
    });

    it('names evaluations booked through checkout and skips other services and pending holds', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const client = await signUp(app, { name: 'Bruno Díaz' });
      const planId = await planIdBySlug(ds, 'rehab-evaluacion');
      const hold = await client.agent.post('/api/checkout/booking').send({ planId, timeSlotId: await rehabSlot('11:00') }).expect(201);
      await sync(staff.agent);
      expect(google.inserted).toEqual([]);

      await ds.query(`UPDATE bookings SET status = 'confirmed', confirmed_at = now() WHERE id = $1`, [hold.body.bookingId]);
      await sync(staff.agent);
      const [event] = [...google.calendarEvents(CALENDAR).values()];
      expect(event.summary).toBe('Rehab · Evaluación — Bruno Díaz');
    });

    it('records item errors and retries them on the next pass without touching the booking', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const client = await followupClient();
      const booking = await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot() }).expect(201);
      google.failWith('transient', 'insertEvent');
      const push = await app.get(CalendarPushJob).execute({ force: true });
      expect(push.result).toEqual({ created: 0, deleted: 0, failed: 1 });
      const [row] = await ds.query(`SELECT status, last_error_code FROM calendar_connections`);
      expect(row).toEqual({ status: 'connected', last_error_code: 'transient' });
      expect(await count('calendar_event_links')).toBe(0);

      google.clearFailures();
      await sync(staff.agent);
      expect(await count('calendar_event_links')).toBe(1);
      const [stored] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [booking.body.id]);
      expect(stored.status).toBe('confirmed');
    });
  });

  describe('Google → MOVE (pull) and availability', () => {
    it('answers POST /staff/time-slots with the calendar flags of the contract', async () => {
      const staff = await signUpStaff(app, ds);
      const professionalId = await createProfessional(ds);
      const res = await staff.agent.post('/api/staff/time-slots')
        .send({ service: 'rehab', date: tomorrow(), startTime: '12:00', durationMinutes: 60, capacity: 1, professionalId })
        .expect(201);
      expect(res.body).toMatchObject({ booked: 0, calendarBlocked: false, calendarConflict: false });
    });

    it('never confirms an expired hold on a slot busy in Google when its payment arrives late (D43, D23)', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const client = await signUp(app, { name: 'Bruno Díaz' });
      const planId = await planIdBySlug(ds, 'rehab-evaluacion');
      const hold = await client.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(201);
      const bookingId = hold.body.bookingId as string;
      await ds.query(`UPDATE bookings SET status = 'expired', cancelled_by = 'system', cancelled_at = now() WHERE id = $1`, [bookingId]);
      busyOver('10:00');
      await sync(staff.agent);
      expect(await blockedAt(slotId)).not.toBeNull();

      const late = await request(app.getHttpServer()).post('/api/payments/dev/simulate')
        .send({ externalReference: hold.body.externalReference, outcome: 'approved' }).expect(200);
      expect(late.body).toMatchObject({ status: 'approved', needsAttention: true });
      const [booking] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [bookingId]);
      expect(booking.status).toBe('expired');
      expect(await count(`email_logs WHERE template = 'booking-confirmed'`)).toBe(0);
    });

    it('blocks a slot overlapped by a busy event and frees it when the event goes away', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const freeSlotId = await rehabSlot('14:00');
      const eventId = busyOver('10:00');

      await sync(staff.agent);
      expect(await blockedAt(slotId)).not.toBeNull();
      expect(await blockedAt(freeSlotId)).toBeNull();
      const slots = await staff.agent.get(`/api/staff/time-slots?date=${tomorrow()}&service=rehab`).expect(200);
      expect(slots.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({ calendarBlocked: true, calendarConflict: false });
      expect(slots.body.find((s: { id: string }) => s.id === freeSlotId)).toMatchObject({ calendarBlocked: false, calendarConflict: false });

      google.removeEvent(CALENDAR, eventId);
      await sync(staff.agent);
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('ignores free (transparent) events', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const start = businessDateTime(tomorrow(), '10:00');
      google.addEvent(CALENDAR, start, new Date(start.getTime() + 3_600_000), { transparency: 'transparent' });
      await sync(staff.agent);
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('hides a blocked slot and rejects it on every booking route with SLOT_NOT_BOOKABLE', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      busyOver('10:00');
      await sync(staff.agent);

      const anonymous = request(app.getHttpServer());
      const listed = await anonymous.get(`/api/schedule/time-slots?service=rehab&date=${tomorrow()}`).expect(200);
      expect(listed.body.map((s: { id: string }) => s.id)).not.toContain(slotId);
      const availability = await anonymous.get(`/api/schedule/availability?service=rehab&from=${tomorrow()}&days=1`).expect(200);
      expect(availability.body).toEqual([{ date: tomorrow(), available: 0 }]);

      const planId = await planIdBySlug(ds, 'rehab-evaluacion');
      const guest = { name: 'Invitada Test', email: 'invitada@test.move', phone: '099123456' };
      await anonymous.post('/api/checkout/booking').send({ planId, timeSlotId: slotId, guest })
        .expect(409).expect(expectCode('SLOT_NOT_BOOKABLE'));
      expect(await count(`users WHERE email = $1`, [guest.email])).toBe(0);

      const client = await followupClient();
      await client.agent.post('/api/checkout/booking').send({ planId, timeSlotId: slotId }).expect(409).expect(expectCode('SLOT_NOT_BOOKABLE'));
      await client.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(409).expect(expectCode('SLOT_NOT_BOOKABLE'));
      expect(await count(`bookings WHERE time_slot_id = $1`, [slotId])).toBe(0);
    });

    it('keeps an existing booking when its slot becomes busy and tells staff once (D95)', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const client = await followupClient();
      const booking = await client.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      busyOver('10:00');

      await sync(staff.agent);
      await sync(staff.agent);

      const [stored] = await ds.query(`SELECT status FROM bookings WHERE id = $1`, [booking.body.id]);
      expect(stored.status).toBe('confirmed');
      expect(await blockedAt(slotId)).not.toBeNull();
      expect(await emails(`staff-calendar-conflict:${slotId}:${booking.body.id}`)).toBe(1);
      expect(await count(`email_logs WHERE template = 'staff-calendar-conflict'`)).toBe(1);
      const slots = await staff.agent.get(`/api/staff/time-slots?date=${tomorrow()}&service=rehab`).expect(200);
      expect(slots.body.find((s: { id: string }) => s.id === slotId)).toMatchObject({ calendarBlocked: true, calendarConflict: true, booked: 1 });
    });

    it('tells staff again about a new conflict on the same slot with another booking (D113)', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const first = await followupClient();
      const a = await first.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      const eventId = busyOver('10:00');
      await sync(staff.agent);
      await staff.agent.post(`/api/staff/bookings/${a.body.id}/cancel`).expect(200);
      google.removeEvent(CALENDAR, eventId);
      await sync(staff.agent);
      expect(await blockedAt(slotId)).toBeNull();

      const second = await followupClient();
      const b = await second.agent.post('/api/bookings').send({ timeSlotId: slotId }).expect(201);
      busyOver('10:00');
      await sync(staff.agent);
      await sync(staff.agent);

      expect(await emails(`staff-calendar-conflict:${slotId}:${a.body.id}`)).toBe(1);
      expect(await emails(`staff-calendar-conflict:${slotId}:${b.body.id}`)).toBe(1);
      expect(await count(`email_logs WHERE template = 'staff-calendar-conflict'`)).toBe(2);
    });

    it('keeps the last blocks when Google fails transiently', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const eventId = busyOver('10:00');
      await sync(staff.agent);
      google.removeEvent(CALENDAR, eventId);
      google.failWith('transient', 'listEvents');

      await sync(staff.agent);
      expect(await blockedAt(slotId)).not.toBeNull();
      const [row] = await ds.query(`SELECT status, last_error_code FROM calendar_connections`);
      expect(row).toEqual({ status: 'connected', last_error_code: 'transient' });
    });
  });

  describe('lost access and disconnection', () => {
    it('moves to needs_reconnect on invalid_grant, frees the slots, tells staff once and resumes after reconnecting', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      busyOver('10:00');
      await sync(staff.agent);
      expect(await blockedAt(slotId)).not.toBeNull();

      google.failWith('invalid_grant', 'refreshAccessToken');
      const status = await sync(staff.agent);
      expect(status.body).toMatchObject({ status: 'needs_reconnect', calendarId: CALENDAR });
      expect(await blockedAt(slotId)).toBeNull();
      const [{ id }] = await ds.query(`SELECT id FROM calendar_connections`);
      const mailKey = `staff-calendar-disconnected:${id}:${businessToday()}:invalid_grant`;
      expect(await emails(mailKey)).toBe(1);

      await sync(staff.agent);
      expect(await emails(mailKey)).toBe(1);
      await staff.agent.get('/api/staff/calendar/calendars').expect(409).expect(expectCode('CALENDAR_NOT_CONNECTED'));

      // While disconnected nothing is pushed; after reconnecting the same account the calendar is kept and the
      // pending event is created.
      const client = await followupClient();
      await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot('14:00') }).expect(201);
      google.clearFailures();
      await connect(staff.agent, 'again');
      const resumed = await sync(staff.agent);
      expect(resumed.body).toMatchObject({ status: 'connected', calendarId: CALENDAR });
      expect(google.inserted).toHaveLength(1);
      expect(await blockedAt(slotId)).not.toBeNull();
      expect(await count('calendar_connections')).toBe(1);
    });

    it.each([
      ['not_found', 'calendar_not_found'],
      ['other', 'calendar_forbidden'],
    ] as const)('treats a %s (404/403) on the chosen calendar as lost access (D113)', async (kind, code) => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      busyOver('10:00');
      await sync(staff.agent);
      expect(await blockedAt(slotId)).not.toBeNull();

      const client = await followupClient();
      await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot('14:00') }).expect(201);
      await sync(staff.agent);
      expect(await count('calendar_event_links')).toBe(1);

      google.failWith(kind, 'listEvents');
      const status = await sync(staff.agent);
      expect(status.body).toMatchObject({ status: 'needs_reconnect', calendarId: null, calendarName: null });
      expect(await blockedAt(slotId)).toBeNull();
      expect(await count('calendar_event_links')).toBe(0);
      const [{ id, last_error_code }] = await ds.query(`SELECT id, last_error_code FROM calendar_connections`);
      expect(last_error_code).toBe(code);
      expect(await emails(`staff-calendar-disconnected:${id}:${businessToday()}:${code}`)).toBe(1);

      // I-1 (review a2): reconnecting the same account lands without a calendar, so staff picks one and sync resumes.
      google.clearFailures();
      await connect(staff.agent, 'again');
      const reconnected = await staff.agent.get('/api/staff/calendar').expect(200);
      expect(reconnected.body).toMatchObject({ status: 'connected', calendarId: null, calendarName: null });
      await staff.agent.patch('/api/staff/calendar').send({ calendarId: 'agenda@move.test' }).expect(200);
      const resumed = await sync(staff.agent);
      expect(resumed.body).toMatchObject({ status: 'connected', calendarId: 'agenda@move.test', calendarName: 'Agenda' });
      expect(await count('calendar_event_links')).toBe(1);
    });

    it('emails staff again the same day when the connection is lost for a different reason (D115)', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      google.failWith('invalid_grant', 'refreshAccessToken');
      await sync(staff.agent);
      google.clearFailures();
      await connect(staff.agent, 'again');
      google.failWith('not_found', 'listEvents');
      const status = await sync(staff.agent);
      expect(status.body.status).toBe('needs_reconnect');

      const [{ id }] = await ds.query(`SELECT id FROM calendar_connections`);
      expect(await emails(`staff-calendar-disconnected:${id}:${businessToday()}:invalid_grant`)).toBe(1);
      expect(await emails(`staff-calendar-disconnected:${id}:${businessToday()}:calendar_not_found`)).toBe(1);
    });

    it('treats a 401 from Google while listing calendars as lost access', async () => {
      const staff = await signUpStaff(app, ds);
      await connect(staff.agent);
      google.failWith('invalid_grant', 'listCalendars');
      await staff.agent.get('/api/staff/calendar/calendars').expect(409).expect(expectCode('CALENDAR_NOT_CONNECTED'));
      const status = await staff.agent.get('/api/staff/calendar').expect(200);
      expect(status.body.status).toBe('needs_reconnect');
    });

    it('disconnects: revokes the token, clears the connection, links and blocks and leaves the events in Google', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const client = await followupClient();
      await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot('14:00') }).expect(201);
      busyOver('10:00');
      await sync(staff.agent);
      expect(await count('calendar_event_links')).toBe(1);

      const res = await staff.agent.delete('/api/staff/calendar').expect(200);
      expect(res.body).toEqual({
        configured: true, status: 'disconnected', accountEmail: null, calendarId: null, calendarName: null, lastPushAt: null, lastPullAt: null,
      });
      expect(google.revoked).toEqual(['1//refresh-abc']);
      expect(await count('calendar_connections WHERE deleted_at IS NULL')).toBe(0);
      expect(await count(`calendar_connections WHERE refresh_token_enc <> ''`)).toBe(0);
      expect(await count('calendar_event_links')).toBe(0);
      expect(await blockedAt(slotId)).toBeNull();
      expect(google.calendarEvents(CALENDAR).size).toBe(2);

      await sync(staff.agent);
      expect(google.inserted).toHaveLength(1);
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('still disconnects when Google fails to revoke the token', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      google.failWith('transient', 'revoke');
      const res = await staff.agent.delete('/api/staff/calendar').expect(200);
      expect(res.body.status).toBe('disconnected');
      expect(await count('calendar_connections WHERE deleted_at IS NULL')).toBe(0);
    });
  });

  describe('connection changes while a sync talks to Google (I-1, m-3)', () => {
    const live = () => count('calendar_connections WHERE deleted_at IS NULL');

    // Pull has read the connection and is waiting on events.list when `change` runs.
    const duringPull = async (change: (agent: TestAgent) => Promise<unknown>) => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      busyOver('10:00');
      const held = google.hold('listEvents');
      const pull = staff.agent.post('/api/staff/calendar/sync').then((r) => r);
      await held.reached;
      await change(staff.agent);
      held.release();
      expect((await pull).status).toBe(200);
      return slotId;
    };

    it('a disconnect during a pull leaves no block behind', async () => {
      const slotId = await duringPull((agent) => agent.delete('/api/staff/calendar').expect(200));
      expect(await live()).toBe(0);
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('losing access during a pull leaves no block behind', async () => {
      const slotId = await duringPull(async () => {
        const [{ id }] = await ds.query(`SELECT id FROM calendar_connections`);
        await app.get(CalendarConnectionService).markNeedsReconnect(id as string);
      });
      const [row] = await ds.query(`SELECT status FROM calendar_connections`);
      expect(row.status).toBe('needs_reconnect');
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('a calendar change during a pull does not apply the old calendar busy times', async () => {
      const slotId = await duringPull((agent) => agent.patch('/api/staff/calendar').send({ calendarId: 'agenda@move.test' }).expect(200));
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('a 404 for the old calendar after a calendar change does not mark the new one as lost (m-1, review a2)', async () => {
      await duringPull(async (agent) => {
        await agent.patch('/api/staff/calendar').send({ calendarId: 'agenda@move.test' }).expect(200);
        google.failWith('not_found', 'listEvents');
      });
      const [row] = await ds.query(`SELECT status, calendar_id, last_error_code FROM calendar_connections`);
      expect(row).toMatchObject({ status: 'connected', calendar_id: 'agenda@move.test' });
      expect(row.last_error_code).not.toBe('calendar_not_found');
      expect(await count(`email_logs WHERE template = 'staff-calendar-disconnected'`)).toBe(0);
    });

    it('a disconnect waits for a pull that is already writing its blocks, then clears them', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      busyOver('10:00');

      const gate = ds.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      let pull: Promise<request.Response> | undefined;
      let disconnect: Promise<request.Response> | undefined;
      try {
        await gate.query(`SELECT id FROM time_slots WHERE id = $1 FOR UPDATE`, [slotId]);
        pull = staff.agent.post('/api/staff/calendar/sync').then((r) => r);
        await waitForLockWaiters(ds, 1);
        disconnect = staff.agent.delete('/api/staff/calendar').then((r) => r);
        await waitForLockWaiters(ds, 2);
      } finally {
        await gate.commitTransaction();
        await gate.release();
      }
      const [pullRes, disconnectRes] = await Promise.all([pull!, disconnect!]);
      expect(pullRes.status).toBe(200);
      expect(disconnectRes.status).toBe(200);
      expect(await live()).toBe(0);
      expect(await blockedAt(slotId)).toBeNull();
    });

    it('a calendar change while push creates an event leaves no stale link, so the booking reaches the new calendar', async () => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const client = await followupClient();
      const booking = await client.agent.post('/api/bookings').send({ timeSlotId: await rehabSlot('10:00') }).expect(201);
      const held = google.hold('insertEvent');
      const push = staff.agent.post('/api/staff/calendar/sync').then((r) => r);
      await held.reached;
      await staff.agent.patch('/api/staff/calendar').send({ calendarId: 'agenda@move.test' }).expect(200);
      held.release();
      expect((await push).status).toBe(200);
      expect(await count('calendar_event_links')).toBe(0);

      await sync(staff.agent);
      const eventId = `move${(booking.body.id as string).replaceAll('-', '')}`;
      expect(google.calendarEvents('agenda@move.test').has(eventId)).toBe(true);
      expect(await count('calendar_event_links')).toBe(1);
    });
  });

  describe('concurrency: a pull blocks the slot a client is booking', () => {
    // A separate transaction holds the slot lock so the booking and the pull both queue on it; `first` decides which
    // one reaches the lock first.
    const race = async (first: 'booking' | 'pull') => {
      const staff = await signUpStaff(app, ds);
      await connectAndChoose(staff.agent);
      const slotId = await rehabSlot('10:00');
      const client = await followupClient();
      busyOver('10:00');

      const gate = ds.createQueryRunner();
      await gate.connect();
      await gate.startTransaction();
      let booking: Promise<request.Response> | undefined;
      let pull: Promise<request.Response> | undefined;
      try {
        await gate.query(`SELECT id FROM time_slots WHERE id = $1 FOR UPDATE`, [slotId]);
        const startBooking = () => client.agent.post('/api/bookings').send({ timeSlotId: slotId }).then((r) => r);
        const startPull = () => staff.agent.post('/api/staff/calendar/sync').then((r) => r);
        if (first === 'booking') {
          booking = startBooking();
          await waitForLockWaiters(ds, 1);
          pull = startPull();
        } else {
          pull = startPull();
          await waitForLockWaiters(ds, 1);
          booking = startBooking();
        }
        await waitForLockWaiters(ds, 2);
      } finally {
        await gate.commitTransaction();
        await gate.release();
      }
      const [bookingRes, pullRes] = await Promise.all([booking!, pull!]);
      expect(pullRes.status).toBe(200);
      expect(await blockedAt(slotId)).not.toBeNull();
      const conflictMails = await count(`email_logs WHERE idempotency_key LIKE $1`, [`staff-calendar-conflict:${slotId}:%`]);
      // Never a confirmed booking without the conflict notice.
      if (bookingRes.status === 201) expect(conflictMails).toBe(1);
      return { bookingRes, conflictMails, slotId };
    };

    it('booking first: the booking is confirmed and staff is told about the conflict', async () => {
      const { bookingRes, conflictMails } = await race('booking');
      expect(bookingRes.status).toBe(201);
      expect(bookingRes.body.status).toBe('confirmed');
      expect(conflictMails).toBe(1);
    });

    it('pull first: the booking is rejected with SLOT_NOT_BOOKABLE and nobody is told', async () => {
      const { bookingRes, conflictMails, slotId } = await race('pull');
      expect(bookingRes.status).toBe(409);
      expect(bookingRes.body.code).toBe('SLOT_NOT_BOOKABLE');
      expect(conflictMails).toBe(0);
      expect(await count(`bookings WHERE time_slot_id = $1`, [slotId])).toBe(0);
    });
  });
});
