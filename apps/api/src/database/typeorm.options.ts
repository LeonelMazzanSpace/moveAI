import { join } from 'node:path';
import pg from 'pg';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/database.config.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

// DATE columns hold business dates (America/Montevideo): keep them as 'YYYY-MM-DD' strings.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export const buildDataSourceOptions = (config: DatabaseConfig): DataSourceOptions => ({
  type: 'postgres',
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.name,
  ssl: config.ssl,
  namingStrategy: new SnakeNamingStrategy(),
  uuidExtension: 'pgcrypto',
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
  synchronize: false,
});
