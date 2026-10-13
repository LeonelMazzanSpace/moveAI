// Entorno de las pruebas end to end de la web (D73): base, puertos y variables de los servidores que levanta Playwright.
// Lo comparten `playwright.config.ts` y `scripts/e2e/reset.mjs`. Sin archivos `.env` (D61): el resto de las variables
// de la API (DB_HOST, DB_USER, DB_PASSWORD, BETTER_AUTH_SECRET…) se toman del entorno del proceso.

export const E2E_DB_NAME = process.env.E2E_DB_NAME ?? 'move_e2e';
export const E2E_API_PORT = 3150;
export const E2E_WEB_PORT = 3250;
export const E2E_API_ORIGIN = `http://localhost:${E2E_API_PORT}`;
export const E2E_API_URL = `${E2E_API_ORIGIN}/api`;
export const E2E_WEB_URL = `http://localhost:${E2E_WEB_PORT}`;
export const E2E_STAFF_EMAIL = process.env.E2E_STAFF_EMAIL ?? 'staff.e2e@example.com';
export const E2E_STAFF_NAME = 'Staff E2E';
export const E2E_PROFESSIONAL_NAME = 'Profesional E2E';
export const E2E_DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? 'move-postgres';

// Nunca se usa (ni se reinicia) una base que no sea de E2E. Corre al cargar este módulo, así toda entrada
// (playwright.config.ts, reset.mjs, las specs) se niega antes de tocar nada.
export function assertE2eDatabase() {
  if (!/^move_e2e\w*$/.test(E2E_DB_NAME)) {
    throw new Error(`E2E_DB_NAME debe empezar con move_e2e (recibido: ${E2E_DB_NAME}).`);
  }
}

assertE2eDatabase();

// El reset borra la base en el contenedor local: las migraciones, el seed y la API tienen que ir al mismo Postgres.
export function assertLocalDatabaseHost() {
  const host = process.env.DB_HOST ?? 'localhost';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    throw new Error(`Las pruebas end to end solo usan el Postgres local (DB_HOST recibido: ${host}).`);
  }
}

// API en modo desarrollo: simulador de Mercado Pago y Brevo en dry-run (sin credenciales), sin crons.
// TRUST_PROXY_HOPS=1 deja que cada prueba se identifique con su propio X-Forwarded-For, así el throttling por IP del
// checkout (D53/D58) no mezcla pruebas que corren en paralelo.
export function apiEnv() {
  return {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(E2E_API_PORT),
    DB_NAME: E2E_DB_NAME,
    WEB_URL: E2E_WEB_URL,
    API_PUBLIC_URL: E2E_API_ORIGIN,
    COOKIE_DOMAIN: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    MP_ACCESS_TOKEN: '',
    MP_WEBHOOK_SECRET: '',
    BREVO_API_KEY: '',
    BREVO_SENDER_EMAIL: '',
    SCHEDULER_ENABLED: 'false',
    TRUST_PROXY_HOPS: '1',
  };
}

// Build y servidor de producción de la web, apuntando a la API de E2E. NODE_ENV lo fijan los scripts de la web.
export function webEnv() {
  const env = { ...process.env, NEXT_PUBLIC_API_URL: E2E_API_URL, NEXT_PUBLIC_GOOGLE_ENABLED: 'false' };
  delete env.NODE_ENV;
  return env;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}
