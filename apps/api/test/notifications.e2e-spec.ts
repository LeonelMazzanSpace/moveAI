import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { appConfig } from '../src/config/app.config.js';
import { databaseConfig, type DatabaseConfig } from '../src/config/database.config.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { NotificationsModule } from '../src/modules/notifications/notifications.module.js';
import { NotificationsService } from '../src/modules/notifications/services/notifications.service.js';

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
