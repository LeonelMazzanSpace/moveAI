import { registerAs, type ConfigType } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USER ?? '',
  password: process.env.DB_PASSWORD ?? '',
  name: process.env.DB_NAME ?? '',
  ssl: process.env.DB_SSL === 'true',
}));

export type DatabaseConfig = ConfigType<typeof databaseConfig>;
