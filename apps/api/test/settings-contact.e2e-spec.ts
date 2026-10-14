import request from 'supertest';
import { ContactSettings1791994561975 } from '../src/database/migrations/1791994561975-ContactSettings.js';
import { CONTACT_DB_KEYS, CONTACT_DEFAULTS } from '../src/modules/settings/settings.defaults.js';
import { createTestApp, type TestApp } from './utils/app.js';
import { signUpClient, signUpStaff } from './utils/auth.js';
import { resetDb } from './utils/db.js';

const { staffNotificationsEmail: _staffOnly, ...PUBLIC_SEEDS } = CONTACT_DEFAULTS;

describe('contact settings (e2e)', () => {
  let ctx: TestApp;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { await ctx.app.close(); });
  beforeEach(async () => { await resetDb(ctx.dataSource); });

  const http = () => request(ctx.app.getHttpServer());

  it('serves the seeds publicly without the staff notifications email', async () => {
    const res = await http().get('/api/settings/contact').expect(200);
    expect(res.body).toEqual({
      address: 'Máximo Tajes 6397 esquina Beranger',
      hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
      whatsapp: '+598 99 140 299',
      instagram: '@move_strengthconditioning',
      email: '',
      mapsUrl: CONTACT_DEFAULTS.mapsUrl,
    });
    expect(res.body).not.toHaveProperty('staffNotificationsEmail');
    expect(res.body).toEqual(PUBLIC_SEEDS);
  });

  it('still never leaks the staff email publicly once it is configured', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    await agent.patch('/api/staff/settings/contact').send({ staffNotificationsEmail: 'avisos@move.test' }).expect(200);
    const res = await http().get('/api/settings/contact').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('avisos@move.test');
  });

  it('lets staff read the contact data including the notifications email', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.get('/api/staff/settings/contact').expect(200);
    expect(res.body).toEqual(CONTACT_DEFAULTS);
  });

  it('keeps the operational settings separate from the contact data', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.get('/api/staff/settings').expect(200);
    expect(Object.keys(res.body)).toHaveLength(12);
    expect(res.body).not.toHaveProperty('address');
    await agent.patch('/api/staff/settings').send({ cancelLimitHours: 3 }).expect(200);
    expect((await agent.get('/api/staff/settings/contact').expect(200)).body).toEqual(CONTACT_DEFAULTS);
  });

  it('saves a trimmed patch, keeps the other fields and records updated_by', async () => {
    const { agent, userId } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent
      .patch('/api/staff/settings/contact')
      .send({ address: '  Calle Nueva 123  ', email: ' hola@move.test ', staffNotificationsEmail: ' avisos@move.test ' })
      .expect(200);
    const expected = { ...CONTACT_DEFAULTS, address: 'Calle Nueva 123', email: 'hola@move.test', staffNotificationsEmail: 'avisos@move.test' };
    expect(res.body).toEqual(expected);
    expect((await agent.get('/api/staff/settings/contact').expect(200)).body).toEqual(expected);
    expect((await http().get('/api/settings/contact').expect(200)).body.address).toBe('Calle Nueva 123');
    const rows = await ctx.dataSource.query(`SELECT key FROM settings WHERE updated_by = $1 ORDER BY key`, [userId]);
    expect(rows).toEqual([{ key: 'contact_address' }, { key: 'contact_email' }, { key: 'staff_notifications_email' }]);
  });

  it('patches one field and leaves every other field untouched', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.patch('/api/staff/settings/contact').send({ hours: 'Lunes a sábado' }).expect(200);
    expect(res.body).toEqual({ ...CONTACT_DEFAULTS, hours: 'Lunes a sábado' });
  });

  it('clears a field with an empty string and keeps it hidden', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    await agent.patch('/api/staff/settings/contact').send({ whatsapp: '', instagram: '   ' }).expect(200);
    const res = await http().get('/api/settings/contact').expect(200);
    expect(res.body).toMatchObject({ whatsapp: '', instagram: '' });
    expect(res.body.address).toBe(CONTACT_DEFAULTS.address);
  });

  it('accepts an empty patch and changes nothing', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    expect((await agent.patch('/api/staff/settings/contact').send({}).expect(200)).body).toEqual(CONTACT_DEFAULTS);
  });

  it('falls back to the seed when a contact row is missing', async () => {
    await ctx.dataSource.query(`DELETE FROM settings WHERE key = 'contact_hours'`);
    expect((await http().get('/api/settings/contact').expect(200)).body.hours).toBe(CONTACT_DEFAULTS.hours);
  });

  it('is forbidden for clients and unauthenticated users on the staff routes', async () => {
    const { agent } = await signUpClient(ctx.app);
    await agent.get('/api/staff/settings/contact').expect(403);
    await agent.patch('/api/staff/settings/contact').send({ address: 'x' }).expect(403);
    await http().get('/api/staff/settings/contact').expect(401);
    await http().patch('/api/staff/settings/contact').send({ address: 'x' }).expect(401);
    expect((await http().get('/api/settings/contact').expect(200)).body.address).toBe(CONTACT_DEFAULTS.address);
  });

  const INVALID_BODIES: [string, Record<string, unknown>][] = [
    ['address too long', { address: 'x'.repeat(201) }],
    ['hours too long', { hours: 'x'.repeat(201) }],
    ['whatsapp without +', { whatsapp: '598 99 140 299' }],
    ['whatsapp with too few digits', { whatsapp: '+1234567' }],
    ['whatsapp with too many digits', { whatsapp: '+1234567890123456' }],
    ['instagram without @', { instagram: 'move' }],
    ['instagram with a hyphen', { instagram: '@con-guion' }],
    ['email malformed', { email: 'no-es-email' }],
    ['staff email malformed', { staffNotificationsEmail: 'no-es-email' }],
    ['maps url with http', { mapsUrl: 'http://maps.google.com/x' }],
    ['maps url too long', { mapsUrl: `https://x.com/${'a'.repeat(500)}` }],
    ['null instead of clearing', { address: null }],
    ['a number', { hours: 5 }],
    ['a NUL byte', { address: 'a\u0000b' }],
    ['a lone high surrogate in address', { address: '\ud800' }],
    ['a lone low surrogate in hours', { hours: 'a\udc00' }],
    ['a lone surrogate in whatsapp', { whatsapp: '+598 99 14\ud800' }],
    ['a lone surrogate in instagram', { instagram: '@a\ud800' }],
    ['a lone surrogate in email', { email: 'a\ud800@b.com' }],
    ['a lone surrogate in maps url', { mapsUrl: 'https://x.com/\ud800' }],
    ['a lone surrogate in staff email', { staffNotificationsEmail: 'a\udc00@b.com' }],
    ['an unknown field', { nope: 'x' }],
    // M-4: only a plain local@domain address; no quoted local part, line breaks or characters that change a mailto: link.
    ['a quoted email with a line break', { email: '"a\r\nb"@example.com' }],
    ['a quoted email that adds mailto parameters', { email: '"x?cc=a@evil.com&body=hola"@move.uy' }],
    ['an email in angle brackets', { email: '<hola@move.uy>' }],
    ['an email with ?', { email: 'hola?cc=a@move.uy' }],
    ['an email with &', { email: 'a&b@move.uy' }],
    ['a staff email with a line break', { staffNotificationsEmail: 'avisos\n@move.uy' }],
    ['a quoted staff email', { staffNotificationsEmail: '"avisos"@move.uy' }],
    ['a line break in the address', { address: 'Máximo Tajes 6397\nesquina Beranger' }],
    ['a tab in the hours', { hours: 'Lunes\t7:00' }],
    ['a DEL in the address', { address: 'a\u007fb' }],
  ];

  it('accepts plain email addresses (M-4)', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const body = { email: 'hola.move+web@move.com.uy', staffNotificationsEmail: 'avisos_staff-1@sub.move.uy' };
    expect((await agent.patch('/api/staff/settings/contact').send(body).expect(200)).body).toMatchObject(body);
  });

  it('reports a lone surrogate in an email once (T-058 M-4)', async () => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.patch('/api/staff/settings/contact').send({ email: 'a\ud800@b.com' }).expect(400);
    expect(res.body.details).toEqual([{ field: 'email', messages: [expect.any(String)] }]);
  });

  it.each(INVALID_BODIES)('rejects %s with 400 VALIDATION_FAILED and details', async (_label, body) => {
    const { agent } = await signUpStaff(ctx.app, ctx.dataSource);
    const res = await agent.patch('/api/staff/settings/contact').send(body).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details.length).toBeGreaterThan(0);
    expect((await agent.get('/api/staff/settings/contact').expect(200)).body).toEqual(CONTACT_DEFAULTS);
  });

  describe('ContactSettings migration', () => {
    const run = async (work: (runner: ReturnType<typeof ctx.dataSource.createQueryRunner>) => Promise<void>) => {
      const runner = ctx.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await work(runner);
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    };
    const contactRows = (runner: ReturnType<typeof ctx.dataSource.createQueryRunner>) =>
      runner.query(`SELECT key, value FROM settings WHERE key = ANY($1) ORDER BY key`, [Object.values(CONTACT_DB_KEYS)]);

    it('inserts the seeds and leaves rows that already exist untouched', async () => {
      await run(async (runner) => {
        await runner.query(`DELETE FROM settings WHERE key = ANY($1)`, [Object.values(CONTACT_DB_KEYS)]);
        await runner.query(`INSERT INTO settings (key, value) VALUES ('contact_address', to_jsonb('Ya editada'::text))`);
        await new ContactSettings1791994561975().up(runner);
        const rows: { key: string; value: string }[] = await contactRows(runner);
        expect(rows).toHaveLength(7);
        expect(Object.fromEntries(rows.map(({ key, value }) => [key, value]))).toEqual({
          contact_address: 'Ya editada',
          contact_hours: CONTACT_DEFAULTS.hours,
          contact_whatsapp: CONTACT_DEFAULTS.whatsapp,
          contact_instagram: CONTACT_DEFAULTS.instagram,
          contact_email: '',
          contact_maps_url: CONTACT_DEFAULTS.mapsUrl,
          staff_notifications_email: '',
        });
      });
    });

    it('removes the seeds on down', async () => {
      await run(async (runner) => {
        await new ContactSettings1791994561975().down(runner);
        expect(await contactRows(runner)).toEqual([]);
        const [{ count }] = await runner.query(`SELECT count(*)::int AS count FROM settings`);
        expect(count).toBe(12);
      });
    });
  });
});
