import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export default function setup(): void {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const database = process.env.E2E_DATABASE_NAME;
  if (!database) throw new Error('E2E_DATABASE_NAME is required to run e2e tests');
  execSync('pnpm run migration:run', { stdio: 'inherit', env: { ...process.env, DB_NAME: database } });
}
