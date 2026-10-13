import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/database.config.js';
import { SnakeNamingStrategy } from './snake-naming.strategy.js';

export const buildDataSourceOptions = (config: DatabaseConfig): DataSourceOptions => ({
  type: 'postgres',
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.name,
  ssl: config.ssl,
  namingStrategy: new SnakeNamingStrategy(),
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migrations', '*.js')],
  synchronize: false,
});
