// Captura una imagen (1440×900) de cada pantalla del route map de la web, para el manual de usuario, más una pasada mobile
// (390×844) de las pantallas principales y dos vistas de los emails (vista previa de las plantillas).
//
// Requisitos: API y web corriendo contra una base con los datos de `pnpm manual:demo-data`, Chromium de Playwright
// instalado (`pnpm exec playwright install chromium`) y la vista previa de emails generada
// (`pnpm --filter @move/api emails:preview`, deja los HTML en apps/api/tmp/email-preview/).
//
// Variables de entorno:
//   MANUAL_STAFF_PASSWORD   (obligatoria) contraseña del staff de demostración
//   MANUAL_CLIENT_PASSWORD  (obligatoria) contraseña de los clientes de demostración
//   MANUAL_STAFF_EMAIL      (opcional) default staff@example.com
//   WEB_URL                 (obligatoria) origen de TU web, por ejemplo http://localhost:3268
//   API_URL                 (obligatoria) URL de TU API con /api, por ejemplo http://localhost:3168/api
//   (sin valor por defecto: se rechazan los puertos 3000 y 3001, los de la app de desarrollo, salvo con
//   MANUAL_ALLOW_DEV_PORTS=1. WEB_URL y API_URL tienen que ser locales: localhost, 127.0.0.1 o ::1; el script imprime el
//   destino antes de empezar)
//
// Las capturas se toman primero en un directorio temporal. Solo si salieron todas (EXPECTED_IMAGE_COUNT) se arma una
// carpeta nueva junto a docs/manual/img/ y se la renombra en su lugar (nombres estables; arquitectura.png y cualquier
// otro archivo que no sea una captura se conservan). Si algo falla, las imágenes actuales quedan como estaban.
// La última parte recorre el checkout de un paquete Recovery con un cliente sin paquete (Nicolás Acosta): crea una
// compra y la aprueba con el simulador de pagos, y después contrata un débito automático y lo autoriza con el simulador.
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';

const WEB_URL = (process.env.WEB_URL ?? '').replace(/\/$/, '');
const API_URL = (process.env.API_URL ?? '').replace(/\/$/, '');
const STAFF_EMAIL = process.env.MANUAL_STAFF_EMAIL ?? 'staff@example.com';
const IMG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/manual/img');
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };
const EMAIL_PREVIEW_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/api/tmp/email-preview');
const KEPT_IMAGES = new Set(['arquitectura.png']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
// Puertos de la app de desarrollo del usuario: el script nunca captura ni compra contra ellos.
const PROTECTED_PORTS = new Set(['3000', '3001']);
// Cantidad de capturas de este script (01–54 de escritorio y m01–m10 de celular): actualizarla al agregar o quitar una pantalla.
const EXPECTED_IMAGE_COUNT = 64;

const CLIENT_EMAILS = {
  sofia: 'sofia.martinez@example.com',
  federico: 'federico.alvarez@example.com',
  valentina: 'valentina.gomez@example.com',
  nicolas: 'nicolas.acosta@example.com',
  martin: 'martin.rodriguez@example.com',
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

// Se niega a capturar si la API o la web no son locales, no están definidas o son las de la app de desarrollo: el
// recorrido final compra un paquete y un débito a través de API_URL.
function assertLocalTarget(name, value, example) {
  if (!value) throw new Error(`Falta la variable de entorno ${name} (por ejemplo ${example}): no tiene valor por defecto.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} no es una URL válida (por ejemplo ${example}).`);
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${name} no es local: las capturas solo se toman contra una API y una web locales.`);
  }
  if (PROTECTED_PORTS.has(url.port) && process.env.MANUAL_ALLOW_DEV_PORTS !== '1') {
    throw new Error(`${name} apunta al puerto ${url.port}, el de la app de desarrollo: usá los puertos de tu propia API y web (o MANUAL_ALLOW_DEV_PORTS=1 si la app de esos puertos es la tuya y es de demostración).`);
  }
}

let outputDir;

// Reemplaza las capturas anteriores por las nuevas sin dejar nunca un juego a medias: arma una carpeta hermana con todo
// y la renombra en el lugar de la actual (si el segundo renombre falla, vuelve a poner la anterior).
function publishImages() {
  const captured = readdirSync(outputDir).filter((file) => file.endsWith('.png'));
  if (captured.length !== EXPECTED_IMAGE_COUNT) {
    throw new Error(`Se esperaban ${EXPECTED_IMAGE_COUNT} capturas y salieron ${captured.length}.`);
  }
  const staging = `${IMG_DIR}.new`;
  const previous = `${IMG_DIR}.old`;
  // Si una corrida anterior murió entre los dos renombres, las imágenes viejas están en img.old: se recuperan antes de limpiar.
  if (!existsSync(IMG_DIR) && existsSync(previous)) renameSync(previous, IMG_DIR);
  rmSync(staging, { recursive: true, force: true });
  rmSync(previous, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  const hadImages = existsSync(IMG_DIR);
  try {
    if (hadImages) {
      for (const file of readdirSync(IMG_DIR)) {
        if (!file.endsWith('.png') || KEPT_IMAGES.has(file)) copyFileSync(resolve(IMG_DIR, file), resolve(staging, file));
      }
    }
    for (const file of captured) copyFileSync(resolve(outputDir, file), resolve(staging, file));
    if (hadImages) renameSync(IMG_DIR, previous);
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  try {
    renameSync(staging, IMG_DIR);
  } catch (error) {
    if (hadImages) renameSync(previous, IMG_DIR);
    rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  rmSync(previous, { recursive: true, force: true });
}

const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Montevideo' }).format(new Date());

async function newContext(browser, credentials, { mobile = false } = {}) {
  const options = mobile
    ? { ...devices['iPhone 15'], viewport: MOBILE_VIEWPORT, defaultBrowserType: undefined }
    : { viewport: VIEWPORT };
  const context = await browser.newContext({ ...options, locale: 'es-UY', timezoneId: 'America/Montevideo' });
  if (credentials) {
    const response = await context.request.post(`${API_URL}/auth/sign-in/email`, {
      headers: { origin: WEB_URL },
      data: credentials,
    });
    if (!response.ok()) throw new Error(`No se pudo ingresar con ${credentials.email} (${response.status()}).`);
  }
  return context;
}

async function apiGet(context, path) {
  const response = await context.request.get(`${API_URL}${path}`, { headers: { origin: WEB_URL } });
  if (!response.ok()) throw new Error(`GET ${path} → ${response.status()}`);
  return response.json();
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function shot(page, name) {
  await settle(page);
  await page.screenshot({ path: resolve(outputDir, `${name}.png`) });
  const url = new URL(page.url());
  console.log(`• ${name}.png  (${url.pathname}${url.search})`);
}

async function visit(page, name, path) {
  await page.goto(`${WEB_URL}${path}`, { waitUntil: 'domcontentloaded' });
  await shot(page, name);
}

const enabledButton = (page, text) => page.locator('button:not([disabled])').filter({ hasText: text }).first();

async function scrollTo(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
}

// Deja `locator` en el borde de arriba de la pantalla (las secciones con anclas ya traen su margen de scroll).
async function scrollToTop(page, locator, offset = 0) {
  await locator.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  if (offset) await page.evaluate((delta) => window.scrollBy(0, -delta), offset);
}

// Hace clic hasta que aparece `target`: un clic antes de que React hidrate la página no hace nada.
async function clickUntilVisible(button, target) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await button.click();
    try {
      await target.waitFor({ timeout: 2000 });
      return;
    } catch {
      // se reintenta
    }
  }
  throw new Error('La pantalla no respondió al clic.');
}

// Elige el primer día con turnos y el primer horario disponible, y deja `locator` a la vista.
async function pickDayAndSlot(page, locator) {
  await enabledButton(page, /^\d{1,2}$/).click();
  await enabledButton(page, /^\d{2}:\d{2}$/).click();
  await scrollTo(page, locator);
}

// Elige "Débito automático" en el checkout de un plan: un clic antes de que React hidrate la página no hace nada.
async function chooseDebit(page) {
  const radio = page.getByRole('radio', { name: /Débito automático/ });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await radio.check();
    if (await radio.isChecked()) return;
    await page.waitForTimeout(500);
  }
  throw new Error('El checkout no respondió al elegir el débito automático.');
}

// Primer turno de Rehab de los próximos días marcado como ocupado en Google Calendar y con una reserva (conflicto).
async function findConflictSlot(context, today) {
  for (let offset = 0; offset < 14; offset += 1) {
    const date = addDays(today, offset);
    const slot = (await apiGet(context, `/staff/time-slots?date=${date}&service=rehab`)).find((item) => item.calendarConflict);
    if (slot) return { date, slot };
  }
  throw new Error('Falta el turno de Rehab en conflicto con Google Calendar: corré pnpm manual:demo-data.');
}

const addDays = (ymd, days) => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

async function visitFile(page, name, file) {
  await page.goto(pathToFileURL(resolve(EMAIL_PREVIEW_DIR, file)).href, { waitUntil: 'load' });
  await page.screenshot({ path: resolve(outputDir, `${name}.png`) });
  console.log(`• ${name}.png  (${file})`);
}

async function main() {
  assertLocalTarget('API_URL', API_URL, 'http://localhost:3168/api');
  assertLocalTarget('WEB_URL', WEB_URL, 'http://localhost:3268');
  if (!existsSync(resolve(EMAIL_PREVIEW_DIR, 'index.html'))) {
    throw new Error('Falta la vista previa de emails: corré pnpm --filter @move/api emails:preview.');
  }
  console.log(`• Destino: API ${API_URL}; web ${WEB_URL}`);
  const staffPassword = requireEnv('MANUAL_STAFF_PASSWORD');
  const clientPassword = requireEnv('MANUAL_CLIENT_PASSWORD');
  outputDir = mkdtempSync(resolve(tmpdir(), 'move-manual-'));

  const browser = await chromium.launch();
  try {
    const login = (key, options) => newContext(browser, { email: CLIENT_EMAILS[key], password: clientPassword }, options);
    const staffLogin = (options) => newContext(browser, { email: STAFF_EMAIL, password: staffPassword }, options);
    const mobile = { mobile: true };
    const [anon, sofia, federico, valentina, nicolas, martin, staff, anonM, sofiaM, martinM, staffM] = await Promise.all([
      newContext(browser),
      login('sofia'),
      login('federico'),
      login('valentina'),
      login('nicolas'),
      login('martin'),
      staffLogin(),
      newContext(browser, undefined, mobile),
      login('sofia', mobile),
      login('martin', mobile),
      staffLogin(mobile),
    ]);
    const [anonPage, sofiaPage, federicoPage, valentinaPage, nicolasPage, martinPage, staffPage, anonMPage, sofiaMPage, martinMPage, staffMPage] =
      await Promise.all([anon, sofia, federico, valentina, nicolas, martin, staff, anonM, sofiaM, martinM, staffM].map((context) => context.newPage()));

    // Sitio público
    await visit(anonPage, '01-inicio', '/');
    await visit(anonPage, '02-performance', '/performance');
    await scrollTo(anonPage, anonPage.getByRole('heading', { name: 'Horarios y cupos.' }));
    await shot(anonPage, '03-performance-horarios');
    await visit(anonPage, '04-rehab', '/rehab');
    await pickDayAndSlot(anonPage, anonPage.getByRole('heading', { name: /Reservá tu evaluación/i }));
    await shot(anonPage, '05-rehab-reserva');
    await visit(anonPage, '06-recovery', '/recovery');
    // Sin sesión (flujo de invitado).
    await settle(anonPage);
    await clickUntilVisible(anonPage.getByRole('button', { name: 'Sesión individual' }), enabledButton(anonPage, /^\d{1,2}$/));
    await pickDayAndSlot(anonPage, anonPage.getByRole('button', { name: 'Sesión individual' }));
    await shot(anonPage, '07-recovery-reserva');
    await visit(anonPage, '08-planes', '/planes');
    await visit(anonPage, '09-planes-recovery', '/planes?service=recovery');
    await visit(anonPage, '10-reservar-sin-sesion', '/reservar');
    await visit(sofiaPage, '11-reservar', '/reservar');

    // Acceso
    await visit(anonPage, '12-ingresar', '/ingresar');
    await visit(anonPage, '13-registro', '/registro');
    await visit(anonPage, '14-recuperar', '/recuperar');
    await visit(anonPage, '15-restablecer', '/restablecer');
    await visit(anonPage, '16-continuar', '/continuar');

    // Cliente
    await visit(sofiaPage, '17-perfil', '/perfil');
    await visit(sofiaPage, '18-historial', '/historial');
    await visit(federicoPage, '19-reservar-fisioterapia', '/reservar/fisioterapia');
    await enabledButton(federicoPage, /^\d{1,2}$/).click();
    await shot(federicoPage, '20-reservar-fisioterapia-horarios');
    await visit(valentinaPage, '21-check-in', '/check-in');

    // Staff
    const today = todayLocal();
    const clients = await apiGet(staff, '/staff/clients?q=sofia&pageSize=5');
    const sofiaId = clients.items.find((client) => client.email === CLIENT_EMAILS.sofia)?.id;
    const slots = await apiGet(staff, `/staff/time-slots?date=${today}&service=performance`);
    const busiestSlot = [...slots].sort((a, b) => b.booked - a.booked)[0];
    if (!sofiaId || !busiestSlot) throw new Error('Faltan datos de demostración: corré pnpm manual:demo-data.');

    await visit(staffPage, '25-staff-dashboard', '/staff');
    await visit(staffPage, '26-staff-clientes', '/staff/clientes');
    await visit(staffPage, '27-staff-clientes-nuevo', '/staff/clientes/nuevo');
    await visit(staffPage, '28-staff-cliente-detalle', `/staff/clientes/${sofiaId}`);
    await visit(staffPage, '29-staff-turnos', `/staff/turnos?fecha=${today}&servicio=performance&turno=${busiestSlot.id}`);
    await visit(staffPage, '30-staff-pagos', '/staff/pagos');
    await clickUntilVisible(staffPage.getByRole('button', { name: 'Registrar pago manual' }), staffPage.getByRole('dialog'));
    await shot(staffPage, '31-staff-pagos-manual');
    await visit(staffPage, '32-staff-seguimiento', '/staff/seguimiento');
    await clickUntilVisible(staffPage.getByRole('button', { name: 'Contactar', exact: true }).first(), staffPage.getByText(/^Contactar a /));
    await shot(staffPage, '33-staff-seguimiento-contactar');
    await visit(staffPage, '34-staff-seguimiento-checkin', '/staff/seguimiento/check-in');
    await visit(staffPage, '35-staff-configuracion-planes', '/staff/configuracion?tab=planes');
    await visit(staffPage, '36-staff-configuracion-horarios', '/staff/configuracion?tab=horarios');
    await visit(staffPage, '37-staff-configuracion-profesionales', '/staff/configuracion?tab=profesionales');
    await visit(staffPage, '38-staff-configuracion-reglas', '/staff/configuracion?tab=reglas');

    // Equipo, Recovery Room, Dónde estamos y contacto (lo editable desde Configuración → Contacto y Calendario)
    await anonPage.goto(`${WEB_URL}/`, { waitUntil: 'domcontentloaded' });
    await settle(anonPage);
    await scrollToTop(anonPage, anonPage.locator('#equipo'));
    await shot(anonPage, '39-inicio-equipo');
    await scrollToTop(anonPage, anonPage.locator('#contacto'));
    await shot(anonPage, '40-inicio-donde-estamos');
    await anonPage.goto(`${WEB_URL}/recovery`, { waitUntil: 'domcontentloaded' });
    await settle(anonPage);
    await scrollToTop(anonPage, anonPage.locator('#recovery-room'));
    await shot(anonPage, '41-recovery-room');
    await visit(staffPage, '42-staff-configuracion-contacto', '/staff/configuracion?tab=contacto');
    await visit(staffPage, '43-staff-configuracion-calendario', '/staff/configuracion?tab=calendario');

    // Débito automático ya contratado (datos de demostración): perfil de Martín, su ficha y los cobros en Pagos
    await visit(martinPage, '47-perfil-debito', '/perfil');
    const martinId = (await apiGet(staff, '/staff/clients?q=martin&pageSize=5')).items.find((client) => client.email === CLIENT_EMAILS.martin)?.id;
    if (!martinId) throw new Error('Falta el cliente de demostración Martín: corré pnpm manual:demo-data.');
    await staffPage.goto(`${WEB_URL}/staff/clientes/${martinId}`, { waitUntil: 'domcontentloaded' });
    await settle(staffPage);
    await scrollTo(staffPage, staffPage.getByText('Débito automático', { exact: true }).first());
    await shot(staffPage, '48-staff-cliente-debito');
    await visit(staffPage, '49-staff-pagos-debito', '/staff/pagos?origen=debito');

    // Turno de Rehab ocupado en Google Calendar con una reserva (marca de demostración): conflicto
    const conflict = await findConflictSlot(staff, today);
    await visit(staffPage, '50-staff-turnos-conflicto', `/staff/turnos?fecha=${conflict.date}&servicio=rehab&turno=${conflict.slot.id}`);

    // Vista previa de emails (HTML generado por emails:preview, sin red ni base)
    await visitFile(anonPage, '51-emails-vista-previa', 'index.html');
    await visitFile(anonPage, '52-email-recordatorio', 'booking-reminder.html');
    await visitFile(anonPage, '53-email-debito-rechazado', 'auto-debit-charge-failed.html');
    await visitFile(anonPage, '54-email-aviso-staff-rehab', 'staff-rehab-booking.html');

    // Pasada mobile (390×844) de las pantallas principales
    await visit(anonMPage, 'm01-inicio', '/');
    await anonMPage.getByRole('button', { name: 'Abrir menú' }).click();
    await anonMPage.getByRole('navigation', { name: 'Menú principal' }).waitFor();
    await shot(anonMPage, 'm02-menu-publico');
    await anonMPage.goto(`${WEB_URL}/recovery`, { waitUntil: 'domcontentloaded' });
    await settle(anonMPage);
    await scrollToTop(anonMPage, anonMPage.locator('#recovery-room'));
    await shot(anonMPage, 'm03-recovery-room');
    await visit(anonMPage, 'm04-planes', '/planes');
    await visit(martinMPage, 'm05-perfil', '/perfil');
    await sofiaMPage.goto(`${WEB_URL}/checkout/plan/recovery-paquete-8`, { waitUntil: 'domcontentloaded' });
    await settle(sofiaMPage);
    await chooseDebit(sofiaMPage);
    await scrollToTop(sofiaMPage, sofiaMPage.getByRole('radio', { name: 'Pago único' }), 90);
    await shot(sofiaMPage, 'm06-checkout-plan-debito');
    await visit(staffMPage, 'm07-staff-dashboard', '/staff');
    await visit(staffMPage, 'm08-staff-turnos', `/staff/turnos?fecha=${today}&servicio=performance&turno=${busiestSlot.id}`);
    await visit(staffMPage, 'm09-staff-pagos', '/staff/pagos');
    await visit(staffMPage, 'm10-staff-configuracion-contacto', '/staff/configuracion?tab=contacto');

    // Checkout de un paquete Recovery (cliente sin paquete): checkout → simulador de pagos → resultado.
    // Va al final porque deja a Nicolás con un paquete comprado.
    await visit(nicolasPage, '22-checkout-plan', '/checkout/plan/recovery-paquete-8');
    await nicolasPage.getByRole('button', { name: /Pagar con Mercado Pago/i }).click();
    await nicolasPage.waitForURL(/\/checkout\/simulado/);
    await shot(nicolasPage, '23-checkout-simulado');
    await nicolasPage.getByRole('button', { name: 'Aprobar' }).click();
    await nicolasPage.waitForURL(/\/checkout\/resultado/);
    await shot(nicolasPage, '24-checkout-resultado');

    // Débito automático de Recovery con el mismo cliente: checkout (modo débito) → simulador → autorizar → resultado.
    await nicolasPage.goto(`${WEB_URL}/checkout/plan/recovery-paquete-4`, { waitUntil: 'domcontentloaded' });
    await settle(nicolasPage);
    await chooseDebit(nicolasPage);
    await shot(nicolasPage, '44-checkout-plan-debito');
    await nicolasPage.getByRole('button', { name: 'Activar débito automático' }).click();
    await nicolasPage.waitForURL(/\/checkout\/simulado\?debito=/);
    await nicolasPage.getByRole('button', { name: 'Autorizar' }).waitFor();
    await shot(nicolasPage, '45-checkout-simulado-debito');
    await nicolasPage.getByRole('button', { name: 'Autorizar' }).click();
    await nicolasPage.waitForURL(/\/checkout\/resultado\?debito=/);
    await nicolasPage.getByText('Débito automático activo').first().waitFor();
    await shot(nicolasPage, '46-checkout-resultado-debito');
    publishImages();
    console.log(`\nListo: ${readdirSync(outputDir).length} capturas en ${IMG_DIR}`);
  } finally {
    await browser.close();
  }
}

main()
  .catch((error) => {
    console.error(`\nError: ${error.message}\nLas imágenes de docs/manual/img no se modificaron.`);
    process.exitCode = 1;
  })
  .finally(() => {
    if (outputDir) rmSync(outputDir, { recursive: true, force: true });
  });
