import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { appConfig } from '../src/config/app.config.js';
import { brevoConfig } from '../src/config/brevo.config.js';
import { databaseConfig, type DatabaseConfig } from '../src/config/database.config.js';
import { ALL_ENTITIES } from '../src/database/entities.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { EmailLog } from '../src/modules/notifications/entities/email-log.entity.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';
import { NotificationsService } from '../src/modules/notifications/services/notifications.service.js';
import { SettingsService } from '../src/modules/settings/services/settings.service.js';
import { insertDefaultSettings } from '../src/database/seed-data.js';

afterEach(() => vi.restoreAllMocks());

describe('NotificationsService (e2e, dry-run)', () => {
  let service: NotificationsService;
  let ds: DataSource;
  let close: () => Promise<void>;

  beforeAll(async () => {
    delete process.env.BREVO_API_KEY;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig] }),
        TypeOrmModule.forRootAsync({
          inject: [databaseConfig.KEY],
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), entities: ALL_ENTITIES, autoLoadEntities: true }),
        }),
        NotificationsModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(NotificationsService);
    ds = app.get(DataSource);
    close = () => app.close();
  });
  afterAll(async () => { await close(); });
  beforeEach(async () => { await ds.query('DELETE FROM email_logs'); });

  const input = {
    template: 'checkin-invite' as const, to: { email: 'ana@test.move', name: 'Ana' }, userId: null,
    idempotencyKey: 'checkin:abc', params: { name: 'Ana', url: 'http://localhost:3000/check-in' },
  };

  it('skips sending without API key and logs it', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await service.send(input)).toBe('skipped');
    expect(fetchSpy).not.toHaveBeenCalled();
    const [row] = await ds.query(`SELECT status, template FROM email_logs WHERE idempotency_key = 'checkin:abc'`);
    expect(row).toEqual({ status: 'skipped', template: 'checkin-invite' });
  });

  it('never sends the same key twice', async () => {
    await service.send(input);
    expect(await service.send(input)).toBe('duplicate');
    const [{ count }] = await ds.query(`SELECT count(*)::int AS count FROM email_logs`);
    expect(count).toBe(1);
  });
});

describe('NotificationsService.sendToStaff (e2e, dry-run)', () => {
  let service: NotificationsService;
  let ds: DataSource;
  let close: () => Promise<void>;

  beforeAll(async () => {
    delete process.env.BREVO_API_KEY;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig] }),
        TypeOrmModule.forRootAsync({
          inject: [databaseConfig.KEY],
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), entities: ALL_ENTITIES, autoLoadEntities: true }),
        }),
        NotificationsModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(NotificationsService);
    ds = app.get(DataSource);
    close = () => app.close();
  });
  afterAll(async () => { await close(); });
  beforeEach(async () => {
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM settings');
    await insertDefaultSettings(ds);
  });

  const input = {
    template: 'staff-calendar-disconnected' as const,
    idempotencyKey: 'staff-calendar-disconnected:abc:2026-10-14',
    params: { configUrl: 'http://localhost:3000/staff/configuracion?tab=calendario' },
  };
  const countLogs = async () => (await ds.query(`SELECT count(*)::int AS count FROM email_logs`))[0].count as number;

  it('skips without an address: no email_logs row and a log line without personal data', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    expect(await service.sendToStaff(input)).toBe('skipped');
    expect(await countLogs()).toBe(0);
    expect(log).toHaveBeenCalledWith('staff email skipped staff-calendar-disconnected: no address');
  });

  it('with an address and dry-run registers a skipped row with the idempotency key', async () => {
    await ds.query(`UPDATE settings SET value = to_jsonb('avisos@move.test'::text) WHERE key = 'staff_notifications_email'`);
    expect(await service.sendToStaff(input)).toBe('skipped');
    const rows = await ds.query(`SELECT idempotency_key, template, status, user_id FROM email_logs`);
    expect(rows).toEqual([{
      idempotency_key: 'staff-calendar-disconnected:abc:2026-10-14', template: 'staff-calendar-disconnected', status: 'skipped', user_id: null,
    }]);
  });

  it('returns duplicate for the same key and keeps one row', async () => {
    await ds.query(`UPDATE settings SET value = to_jsonb('avisos@move.test'::text) WHERE key = 'staff_notifications_email'`);
    expect(await service.sendToStaff(input)).toBe('skipped');
    expect(await service.sendToStaff(input)).toBe('duplicate');
    expect(await countLogs()).toBe(1);
  });

  it('does not log the staff address', async () => {
    await ds.query(`UPDATE settings SET value = to_jsonb('avisos@move.test'::text) WHERE key = 'staff_notifications_email'`);
    const spies = [vi.spyOn(Logger.prototype, 'log'), vi.spyOn(Logger.prototype, 'warn'), vi.spyOn(Logger.prototype, 'error')];
    spies.forEach((spy) => spy.mockImplementation(() => undefined));
    await service.sendToStaff(input);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('avisos@move.test');
  });
});

describe('NotificationsService (e2e, Brevo enabled, mocked fetch)', () => {
  let service: NotificationsService;
  let ds: DataSource;
  let emailLogs: Repository<EmailLog>;
  let settingsService: SettingsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig] }),
        TypeOrmModule.forRootAsync({
          inject: [databaseConfig.KEY],
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), entities: ALL_ENTITIES, autoLoadEntities: true }),
        }),
        NotificationsModule,
      ],
    })
      .overrideProvider(brevoConfig.KEY)
      .useValue({ apiKey: 'test-key', senderEmail: 'hola@example.com', senderName: 'MOVE', dryRun: false })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    service = app.get(NotificationsService);
    ds = app.get(DataSource);
    emailLogs = app.get(getRepositoryToken(EmailLog));
    settingsService = app.get(SettingsService);
    close = () => app.close();
  });
  afterAll(async () => { await close(); });
  beforeEach(async () => {
    await ds.query('DELETE FROM email_logs');
    await ds.query('DELETE FROM settings');
    await insertDefaultSettings(ds);
  });

  const input = {
    template: 'checkin-invite' as const, to: { email: 'ana@test.move', name: 'Ana' }, userId: null,
    idempotencyKey: 'checkin:live', params: { name: 'Ana', url: 'http://localhost:3000/check-in' },
  };
  const readRow = async () => {
    const [row] = await ds.query(
      `SELECT status, provider_message_id, error_code, sent_at FROM email_logs WHERE idempotency_key = 'checkin:live'`,
    );
    return row;
  };

  it('marks the email as sent with the provider message id', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<m1>' }), { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const row = await readRow();
    expect(row).toMatchObject({ status: 'sent', provider_message_id: '<m1>', error_code: null });
    expect(row.sent_at).toBeInstanceOf(Date);
  });

  it('stores NULL when the response has no message id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    expect(await readRow()).toMatchObject({ status: 'sent', provider_message_id: null });
  });

  it('marks the email as failed with the HTTP status and does not throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }));
    expect(await service.send(input)).toBe('failed');
    expect(await readRow()).toMatchObject({ status: 'failed', error_code: '500', provider_message_id: null, sent_at: null });
  });

  it('marks the email as failed with network when fetch rejects and does not throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    expect(await service.send(input)).toBe('failed');
    expect(await readRow()).toMatchObject({ status: 'failed', error_code: 'network' });
  });

  it('returns sent and never marks the row failed when Brevo accepted but the sent update fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<m3>' }), { status: 201 }));
    const update = emailLogs.update.bind(emailLogs);
    const updateSpy = vi.spyOn(emailLogs, 'update').mockImplementation((criteria, partial) =>
      partial.status === 'sent' ? Promise.reject(new Error('connection lost')) : update(criteria, partial));
    const errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    expect(await service.send(input)).toBe('sent');

    expect(updateSpy).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'sent' }));
    expect(updateSpy).not.toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'failed' }));
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).not.toContain('ana@test.move');
    expect((await readRow()).status).not.toBe('failed');
  });

  const sentBody = (fetchSpy: ReturnType<typeof vi.spyOn>) =>
    JSON.parse((fetchSpy.mock.calls[0][1] as { body: string }).body) as { to: { email: string }[]; htmlContent: string; textContent: string };

  it('adds the contact footer to the email it sends', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<f1>' }), { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    const body = sentBody(fetchSpy);
    expect(body.textContent).toContain('Máximo Tajes 6397 esquina Beranger');
    expect(body.textContent).toContain('WhatsApp +598 99 140 299');
    expect(body.htmlContent).toContain('Instagram @move_strengthconditioning');
  });

  it('omits the footer lines of fields staff cleared', async () => {
    await ds.query(`UPDATE settings SET value = to_jsonb(''::text) WHERE key IN ('contact_instagram', 'contact_whatsapp')`);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    await service.send(input);
    const { textContent } = sentBody(fetchSpy);
    expect(textContent).not.toContain('Instagram');
    expect(textContent).not.toContain('WhatsApp');
    expect(textContent).toContain('Máximo Tajes 6397 esquina Beranger');
  });

  it('sends without a footer and logs email footer unavailable when settings cannot be read', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(settingsService, 'getContact').mockRejectedValue(new Error('db down'));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    expect(sentBody(fetchSpy).textContent).not.toContain('Máximo Tajes');
    expect(warn).toHaveBeenCalledWith('email footer unavailable');
  });

  it('sendToStaff delivers to the configured address through Brevo', async () => {
    await ds.query(`UPDATE settings SET value = to_jsonb('avisos@move.test'::text) WHERE key = 'staff_notifications_email'`);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<s1>' }), { status: 201 }));
    const staffInput = {
      template: 'staff-calendar-disconnected' as const, idempotencyKey: 'staff-calendar-disconnected:live',
      params: { configUrl: 'http://localhost:3000/staff/configuracion?tab=calendario' },
    };
    expect(await service.sendToStaff(staffInput)).toBe('sent');
    expect(sentBody(fetchSpy).to).toEqual([{ email: 'avisos@move.test', name: 'MOVE' }]);
    expect(await service.sendToStaff(staffInput)).toBe('duplicate');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('calls Brevo once and returns duplicate for the same key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<m2>' }), { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    expect(await service.send(input)).toBe('duplicate');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
