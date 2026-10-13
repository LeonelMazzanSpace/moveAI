import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');
const database = process.env.E2E_DATABASE_NAME;
if (!database) throw new Error('E2E_DATABASE_NAME is required to run e2e tests');
process.env.DB_NAME = database;
process.env.NODE_ENV = 'test';
process.env.SCHEDULER_ENABLED = 'false';
