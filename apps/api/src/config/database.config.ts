import { registerAs, type ConfigType } from '@nestjs/config';
import { parsePort } from './env.validation.js';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parsePort(process.env.DB_PORT ?? '5432'),
  username: process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  name: process.env.DB_NAME ?? '',
  ssl: process.env.DB_SSL === 'true',
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
