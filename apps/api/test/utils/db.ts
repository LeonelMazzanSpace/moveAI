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
