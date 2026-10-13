// Usage: pnpm --filter @move/api user:create-staff -- --email <e> --name <n> [--password <p>]
// The password can come from CREATE_STAFF_PASSWORD instead, so it stays out of shell history and pnpm's echo.
// Creates the user (or reuses the one with that email) and promotes it to staff. Prints only the id.
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { BETTER_AUTH } from '../modules/auth/auth.constants.js';
import type { BetterAuthInstance } from '../modules/auth/better-auth.factory.js';
import { cleanText, NAME_LENGTH } from '../modules/users/dto/update-me.dto.js';
import { UsersService } from '../modules/users/services/users.service.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { email: { type: 'string' }, name: { type: 'string' }, password: { type: 'string' } },
});

const email = cleanText(values.email, { min: 3, max: 254 })?.toLowerCase();
const name = cleanText(values.name, NAME_LENGTH);
const password = values.password ?? process.env.CREATE_STAFF_PASSWORD;

if (!email || !name || !password) {
  console.error('Usage: user:create-staff -- --email <email> --name <name> [--password <password>]');
  console.error('Name: 2-80 characters. The password can also be set with CREATE_STAFF_PASSWORD.');
  process.exit(1);
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

try {
  const users = app.get(UsersService);
  const existing = await users.findByEmail(email);
  const userId = existing
    ? existing.id
    : (await app.get<BetterAuthInstance>(BETTER_AUTH).api.signUpEmail({ body: { email, name, password } })).user.id;
  await app.get(DataSource).query(`UPDATE users SET role = 'staff' WHERE id = $1`, [userId]);
  console.log(`staff ${userId}`);
} catch (error) {
  console.error('create-staff failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
} finally {
  await app.close();
}
