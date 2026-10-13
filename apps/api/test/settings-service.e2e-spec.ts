import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseConfig, type DatabaseConfig } from '../src/config/database.config.js';
import { ALL_ENTITIES } from '../src/database/entities.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { InvalidSettingsError, SettingsService } from '../src/modules/settings/services/settings.service.js';
import { SettingsModule } from '../src/modules/settings/settings.module.js';
import { resetDb } from './utils/db.js';

describe('SettingsService (e2e)', () => {
  let ds: DataSource;
  let settings: SettingsService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig] }),
        TypeOrmModule.forRootAsync({
          inject: [databaseConfig.KEY],
          useFactory: (c: DatabaseConfig) => ({ ...buildDataSourceOptions(c), entities: ALL_ENTITIES }),
        }),
        SettingsModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
    settings = app.get(SettingsService);
    close = () => app.close();
  });
  afterAll(async () => { await close(); });
  beforeEach(async () => { await resetDb(ds); });

  it('reads defaults', async () => {
    expect(await settings.getAll()).toMatchObject({ cancelLimitHours: 2, bookingWindowDays: 14, valuesProvisional: true });
  });

  it('updates and rejects inconsistent thresholds', async () => {
    const [{ id }] = await ds.query(`INSERT INTO users (name, email, role) VALUES ('S', 's@test.move', 'staff') RETURNING id`);
    expect((await settings.update({ cancelLimitHours: 4 }, id)).cancelLimitHours).toBe(4);
    await expect(settings.update({ prolongedInactivityDays: 5 }, id)).rejects.toBeInstanceOf(InvalidSettingsError);
  });
});
