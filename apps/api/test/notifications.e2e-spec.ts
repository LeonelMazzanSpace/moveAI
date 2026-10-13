import { Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { appConfig } from '../src/config/app.config.js';
import { brevoConfig } from '../src/config/brevo.config.js';
import { databaseConfig, type DatabaseConfig } from '../src/config/database.config.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { EmailLog } from '../src/modules/notifications/entities/email-log.entity.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';
import { NotificationsService } from '../src/modules/notifications/services/notifications.service.js';

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
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), autoLoadEntities: true }),
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

describe('NotificationsService (e2e, Brevo enabled, mocked fetch)', () => {
  let service: NotificationsService;
  let ds: DataSource;
  let emailLogs: Repository<EmailLog>;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [appConfig, databaseConfig] }),
        TypeOrmModule.forRootAsync({
          inject: [databaseConfig.KEY],
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), autoLoadEntities: true }),
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
    close = () => app.close();
  });
  afterAll(async () => { await close(); });
  beforeEach(async () => { await ds.query('DELETE FROM email_logs'); });

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

  it('calls Brevo once and returns duplicate for the same key', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ messageId: '<m2>' }), { status: 201 }));
    expect(await service.send(input)).toBe('sent');
    expect(await service.send(input)).toBe('duplicate');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
