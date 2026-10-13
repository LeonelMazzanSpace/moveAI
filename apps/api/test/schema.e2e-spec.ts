import { DataSource } from 'typeorm';
import { databaseConfig } from '../src/config/database.config.js';
import { ALL_ENTITIES } from '../src/database/entities.js';
import { seedCatalogAndSchedule } from '../src/database/seed-data.js';
import { buildDataSourceOptions } from '../src/database/typeorm.options.js';
import { resetDb } from './utils/db.js';

describe('schema (e2e)', () => {
  let ds: DataSource;
  beforeAll(async () => {
    ds = new DataSource({ ...buildDataSourceOptions(databaseConfig()), entities: ALL_ENTITIES, migrations: [] });
    await ds.initialize();
  });
  afterAll(async () => { await ds.destroy(); });
  beforeEach(async () => { await resetDb(ds); });

  const insertUser = async (email: string): Promise<string> => {
    const [row] = await ds.query(`INSERT INTO users (name, email) VALUES ('Ana', $1) RETURNING id`, [email]);
    return row.id as string;
  };

  it('has default settings after reset', async () => {
    const rows: { key: string }[] = await ds.query('SELECT key FROM settings ORDER BY key');
    expect(rows).toHaveLength(12);
  });

  it('rejects a second active booking for the same user and slot', async () => {
    const userId = await insertUser('a@test.move');
    const [slot] = await ds.query(
      `INSERT INTO time_slots (service, starts_at, ends_at, capacity) VALUES ('performance', now() + interval '1 day', now() + interval '1 day 1 hour', 14) RETURNING id`,
    );
    const insert = (status: string) =>
      ds.query(`INSERT INTO bookings (user_id, time_slot_id, status, source) VALUES ($1, $2, $3, 'plan')`, [userId, slot.id, status]);
    await insert('confirmed');
    await expect(insert('confirmed')).rejects.toThrow(/UQ_bookings_active_user_slot/);
    await ds.query(`UPDATE bookings SET status = 'cancelled'`);
    await expect(insert('confirmed')).resolves.toBeDefined();
  });

  it('enforces plan shape checks', async () => {
    await expect(
      ds.query(`INSERT INTO plans (service, kind, slug, name, price) VALUES ('performance', 'period_plan', 'x', 'X', 100)`),
    ).rejects.toThrow();
    await expect(
      ds.query(`INSERT INTO plans (service, kind, slug, name, price, period_months) VALUES ('recovery', 'period_plan', 'y', 'Y', 100, 1)`),
    ).rejects.toThrow();
  });

  it('reads date columns as business date strings', async () => {
    const userId = await insertUser('b@test.move');
    await seedCatalogAndSchedule(ds);
    const [plan] = await ds.query(`SELECT id FROM plans WHERE slug = 'performance-mensual'`);
    const [row] = await ds.query(
      `INSERT INTO subscriptions (user_id, plan_id, service, starts_on, ends_on) VALUES ($1, $2, 'performance', '2026-10-12', '2026-11-12') RETURNING starts_on`,
      [userId, plan.id],
    );
    expect(row.starts_on).toBe('2026-10-12');
  });

  it('seeds idempotently', async () => {
    await seedCatalogAndSchedule(ds);
    await seedCatalogAndSchedule(ds);
    const [{ count: plans }] = await ds.query('SELECT count(*)::int AS count FROM plans');
    const [{ count: templates }] = await ds.query('SELECT count(*)::int AS count FROM schedule_templates');
    const [{ count: pros }] = await ds.query('SELECT count(*)::int AS count FROM professionals');
    expect([plans, templates, pros]).toEqual([7, 100, 1]);
  });
});
