import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { databaseConfig, type DatabaseConfig } from '../src/config/database.config.js';
import { ALL_ENTITIES } from '../src/database/entities.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { InvalidSettingsError, SettingsService } from '../src/modules/settings/services/settings.service.js';
import { SettingsModule } from '../src/modules/settings/settings.module.js';
import { resetDb, waitForLockWaiters } from './utils/db.js';

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

  it('checks undefined patch keys against the stored values and persists nothing on rejection', async () => {
    const [{ id }] = await ds.query(`INSERT INTO users (name, email, role) VALUES ('S', 's@test.move', 'staff') RETURNING id`);
    await expect(
      settings.update({ noAttendanceDays: 30, prolongedInactivityDays: undefined }, id),
    ).rejects.toBeInstanceOf(InvalidSettingsError);
    expect(await settings.getAll()).toMatchObject({ noAttendanceDays: 7, prolongedInactivityDays: 21 });
  });

  it('keeps stored values for undefined patch keys', async () => {
    const [{ id }] = await ds.query(`INSERT INTO users (name, email, role) VALUES ('S', 's@test.move', 'staff') RETURNING id`);
    const updated = await settings.update({ cancelLimitHours: 4, bookingWindowDays: undefined }, id);
    expect(updated).toMatchObject({ cancelLimitHours: 4, bookingWindowDays: 14 });
    expect(Object.values(updated).every((value) => value !== undefined)).toBe(true);
    expect(await settings.getAll()).toMatchObject({ cancelLimitHours: 4, bookingWindowDays: 14 });
  });

  it('checks against a concurrent update committed while it waits for the settings lock', async () => {
    const [{ id }] = await ds.query(`INSERT INTO users (name, email, role) VALUES ('S', 's@test.move', 'staff') RETURNING id`);
    const concurrent = ds.createQueryRunner();
    await concurrent.connect();
    await concurrent.startTransaction();
    let pending: Promise<unknown> | undefined;
    try {
      await concurrent.query('SELECT key FROM settings FOR UPDATE');
      await concurrent.query(`UPDATE settings SET value = '20'::jsonb WHERE key = 'no_attendance_days'`);
      pending = settings.update({ prolongedInactivityDays: 15 }, id).then(
        () => 'resolved',
        (error: unknown) => error,
      );
      // Barrier: the update is blocked on the settings row lock before the concurrent write commits.
      await waitForLockWaiters(ds, 1);
      await concurrent.commitTransaction();
      expect(await pending).toBeInstanceOf(InvalidSettingsError);
    } finally {
      if (concurrent.isTransactionActive) await concurrent.rollbackTransaction();
      await concurrent.release();
      await pending;
    }
    expect(await settings.getAll()).toMatchObject({ noAttendanceDays: 20, prolongedInactivityDays: 21 });
  });
});
