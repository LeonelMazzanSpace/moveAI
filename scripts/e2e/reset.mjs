// Deja limpia la base de las pruebas end to end de la web (D73): la borra y la vuelve a crear, corre las migraciones y
// el seed, crea el usuario staff de E2E y carga los datos mínimos por la API (profesional de E2E y turnos de la ventana
// de reserva). Después apaga la API: los servidores de la suite los levanta Playwright (`pnpm test:e2e:web`).
//
// Variables de entorno:
//   E2E_STAFF_PASSWORD  (obligatoria) contraseña del staff de E2E, mínimo 8 caracteres; nunca se imprime
//   E2E_STAFF_EMAIL     (opcional) default staff.e2e@example.com
//   E2E_DB_NAME         (opcional) default move_e2e; tiene que empezar con move_e2e
//   E2E_DB_CONTAINER    (opcional) contenedor de Postgres, default move-postgres
//   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, BETTER_AUTH_SECRET… las de apps/api/.env.example, exportadas (D61)
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  apiEnv,
  assertE2eDatabase,
  assertLocalDatabase,
  E2E_API_URL,
  E2E_DB_CONTAINER,
  E2E_DB_NAME,
  E2E_PROFESSIONAL_NAME,
  E2E_STAFF_EMAIL,
  E2E_STAFF_NAME,
  E2E_WEB_URL,
  requireEnv,
} from './env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const API_DIR = resolve(ROOT, 'apps/api');

/** @param {string} message */
const step = (message) => console.log(`• ${message}`);

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptions} [options]
 */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`Falló: ${command} ${args.slice(0, 2).join(' ')}`);
}

/** @param {string} statement */
function psql(statement) {
  const user = process.env.DB_USER ?? 'move';
  const result = spawnSync(
    'docker',
    ['exec', '-i', E2E_DB_CONTAINER, 'psql', '-U', user, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-c', statement],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`No se pudo reiniciar la base ${E2E_DB_NAME} (¿está levantado ${E2E_DB_CONTAINER}?).`);
}

async function apiIsUp() {
  try {
    return (await fetch(`${E2E_API_URL}/health`)).ok;
  } catch {
    return false;
  }
}

/** @param {import('node:child_process').ChildProcess} child */
async function waitForApi(child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('La API de E2E terminó antes de responder.');
    if (await apiIsUp()) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error('La API de E2E no respondió en 60 s.');
}

/** @param {import('node:child_process').ChildProcess} child */
function stopApi(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((done) => {
    child.once('exit', done);
    child.kill('SIGTERM');
  });
}

/**
 * @param {string | null} cookie
 * @param {string} path
 * @param {unknown} body
 */
async function post(cookie, path, body) {
  /** @type {Record<string, string>} */
  const headers = { origin: E2E_WEB_URL, 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${E2E_API_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`POST ${path} → ${response.status}`);
  return response;
}

/** @param {string} staffPassword */
async function loadMinimalData(staffPassword) {
  const signIn = await post(null, '/auth/sign-in/email', { email: E2E_STAFF_EMAIL, password: staffPassword });
  const cookie = signIn.headers.getSetCookie().map((header) => header.split(';')[0]).join('; ');
  await post(cookie, '/staff/professionals', { name: E2E_PROFESSIONAL_NAME });
  const generated = await (await post(cookie, '/staff/schedule/generate', {})).json();
  step(`Profesional de E2E creado y ${generated.created} turnos generados desde las plantillas`);
}

async function main() {
  const staffPassword = requireEnv('E2E_STAFF_PASSWORD');
  if (staffPassword.length < 8) throw new Error('E2E_STAFF_PASSWORD debe tener al menos 8 caracteres.');
  assertE2eDatabase();
  assertLocalDatabase();
  if (await apiIsUp()) throw new Error(`Ya hay una API respondiendo en ${E2E_API_URL}: detenela antes de reiniciar la base.`);

  step(`Reiniciando la base ${E2E_DB_NAME}`);
  psql(`DROP DATABASE IF EXISTS "${E2E_DB_NAME}" WITH (FORCE)`);
  psql(`CREATE DATABASE "${E2E_DB_NAME}"`);

  const env = apiEnv();
  step('Compilando la API');
  run('pnpm', ['--filter', '@move/api', 'build'], { cwd: ROOT, env });
  step('Migraciones y seed');
  run('pnpm', ['exec', 'typeorm', 'migration:run', '-d', 'dist/database/data-source.js'], {
    cwd: API_DIR,
    env,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  run('node', ['dist/database/seed.js'], { cwd: API_DIR, env });
  step(`Usuario staff ${E2E_STAFF_EMAIL}`);
  run('node', ['dist/cli/create-staff.js', '--email', E2E_STAFF_EMAIL, '--name', E2E_STAFF_NAME], {
    cwd: API_DIR,
    env: { ...env, CREATE_STAFF_PASSWORD: staffPassword },
  });

  step('Datos mínimos por la API');
  const api = spawn('node', ['dist/main.js'], { cwd: API_DIR, env, stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    await waitForApi(api);
    await loadMinimalData(staffPassword);
  } finally {
    await stopApi(api);
  }
  console.log(`\nListo: ${E2E_DB_NAME} preparada para pnpm test:e2e:web.`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
