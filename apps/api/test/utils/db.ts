import type { DataSource } from 'typeorm';
import { insertDefaultSettings } from '../../src/database/seed-data.js';

// Empties every table in `public` except `migrations`, then restores the default settings.
export async function resetDb(dataSource: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'migrations'`,
  );
  if (tables.length > 0) {
    const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
    await dataSource.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
  }
  await insertDefaultSettings(dataSource);
}

// Waits until at least `expected` backends of the database are blocked on a lock: the barrier of the concurrency specs.
export async function waitForLockWaiters(dataSource: DataSource, expected: number): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const [{ waiting }] = await dataSource.query(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if (waiting >= expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`expected ${expected} backends waiting on a lock`);
}
