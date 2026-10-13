// Loads the provisional catalog, schedule templates and default settings. Runs outside Nest, like data-source.ts.
import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config.js';
import { ALL_ENTITIES } from './entities.js';
import { insertDefaultSettings, seedCatalogAndSchedule } from './seed-data.js';
import { buildDataSourceOptions } from './typeorm.options.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const dataSource = new DataSource({ ...buildDataSourceOptions(databaseConfig()), entities: ALL_ENTITIES });

try {
  await dataSource.initialize();
  await insertDefaultSettings(dataSource);
  const inserted = await seedCatalogAndSchedule(dataSource);
  console.log(
    `Seed inserted plans=${inserted.plans} professionals=${inserted.professionals} templates=${inserted.templates}`,
  );
} catch (error) {
  console.error('Seed failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
