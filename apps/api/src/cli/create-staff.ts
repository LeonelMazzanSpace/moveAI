// Usage: pnpm --filter @move/api user:create-staff -- --email <e> --name <n> [--password <p>] [--promote-existing]
// The password can come from CREATE_STAFF_PASSWORD instead, so it stays out of shell history and pnpm's echo.
// Creates the staff user and prints only its id. An existing account with that email is refused unless
// --promote-existing is given (D54): then it gets the given password, loses every session and becomes staff.
// A soft-deleted account is always refused (D72).
import { parseArgs } from 'node:util';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module.js';
import { BETTER_AUTH } from '../modules/auth/auth.constants.js';
import type { BetterAuthInstance } from '../modules/auth/better-auth.factory.js';
import { AuthService } from '../modules/auth/services/auth.service.js';
import { cleanText, EMAIL_LENGTH, NAME_LENGTH } from '../modules/users/dto/update-me.dto.js';
import { UsersService } from '../modules/users/services/users.service.js';

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
    'promote-existing': { type: 'boolean', default: false },
  },
});

const email = cleanText(values.email, EMAIL_LENGTH)?.toLowerCase();
const name = cleanText(values.name, NAME_LENGTH);
const password = values.password ?? process.env.CREATE_STAFF_PASSWORD;
const promoteExisting = values['promote-existing'];

if (!email || !name || !password) {
  console.error(
    'Usage: user:create-staff -- --email <email> --name <name> [--password <password>] [--promote-existing]',
  );
  console.error('Name: 2-80 characters. The password can also be set with CREATE_STAFF_PASSWORD.');
  process.exit(1);
}

async function createStaff(app: INestApplicationContext, input: { email: string; name: string; password: string }) {
  const { user } = await app.get<BetterAuthInstance>(BETTER_AUTH).api.signUpEmail({ body: input });
  await app.get(DataSource).transaction((manager) => app.get(UsersService).setStaffRole(manager, user.id));
  console.log(`staff ${user.id}`);
}

// Returns the process exit code.
async function run(app: INestApplicationContext, input: { email: string; name: string; password: string }) {
  const found = await app.get(UsersService).findByEmailWithDeleted(input.email);
  if (!found) {
    await createStaff(app, input);
    return 0;
  }
  if (found.deleted) {
    console.error('Ese email pertenece a una cuenta dada de baja; no se puede convertir en staff.');
    return 1;
  }
  const existing = found.user;
  if (!promoteExisting) {
    console.error('Ya existe una cuenta con ese email; usá --promote-existing para convertirla en staff.');
    return 1;
  }
  await app.get(AuthService).promoteExistingToStaff(existing.id, input.password);
  console.log(`Cuenta existente ${existing.id} convertida en staff; sesiones revocadas.`);
  return 0;
}

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

try {
  process.exitCode = await run(app, { email, name, password });
} catch (error) {
  console.error('create-staff failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
} finally {
  await app.close();
}
