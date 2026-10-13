// Carga datos de demostración inventados contra la API local (por HTTP) para el manual de usuario.
//
// Requisitos: API corriendo, base migrada con `seed` y un usuario staff creado con
// `user:create-staff` (ver docs/manual/manual-de-usuario.md, parte "Equipo técnico").
//
// Variables de entorno:
//   MANUAL_STAFF_PASSWORD   (obligatoria) contraseña del staff de demostración
//   MANUAL_CLIENT_PASSWORD  (obligatoria) contraseña común de los clientes de demostración (mínimo 8 caracteres)
//   MANUAL_STAFF_EMAIL      (opcional) default staff@example.com
//   API_URL                 (opcional) default http://localhost:3128/api
//   WEB_URL                 (opcional) origen de la web, default http://localhost:3228
//   MANUAL_DB_CONTAINER     (opcional) contenedor de Postgres, default move-postgres
//
// Las contraseñas nunca se imprimen. Falla con un mensaje claro si ya hay datos de demostración.
//
// Parte de la historia (asistencias pasadas, vigencias que vencen o vencieron) no se puede crear por HTTP porque
// la API no permite reservar ni marcar asistencia en el pasado: esos datos se insertan con SQL en la base de
// desarrollo (apps/api/.env → DB_NAME) a través de `docker exec <contenedor> psql`. Solo toca filas de los
// clientes de demostración (emails @example.com definidos acá).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_URL = (process.env.API_URL ?? 'http://localhost:3128/api').replace(/\/$/, '');
const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3228';
const STAFF_EMAIL = process.env.MANUAL_STAFF_EMAIL ?? 'staff@example.com';
const DB_CONTAINER = process.env.MANUAL_DB_CONTAINER ?? 'move-postgres';
const BUSINESS_TZ = 'America/Montevideo';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MS_HOUR = 3_600_000;

const CLIENTS = [
  { key: 'sofia', name: 'Sofía Martínez', email: 'sofia.martinez@example.com', phone: '+598 99 000 101' },
  { key: 'martin', name: 'Martín Rodríguez', email: 'martin.rodriguez@example.com', phone: '+598 99 000 102' },
  { key: 'lucia', name: 'Lucía Pereira', email: 'lucia.pereira@example.com', phone: '+598 99 000 103' },
  { key: 'andres', name: 'Andrés Silva', email: 'andres.silva@example.com', phone: '+598 99 000 104' },
  { key: 'camila', name: 'Camila Fernández', email: 'camila.fernandez@example.com', phone: '+598 99 000 105' },
  { key: 'joaquin', name: 'Joaquín Techera', email: 'joaquin.techera@example.com', phone: '+598 99 000 106' },
  { key: 'valentina', name: 'Valentina Gómez', email: 'valentina.gomez@example.com', phone: '+598 99 000 107' },
  { key: 'federico', name: 'Federico Álvarez', email: 'federico.alvarez@example.com', phone: '+598 99 000 108' },
  { key: 'diego', name: 'Diego Machado', email: 'diego.machado@example.com', phone: '+598 99 000 109' },
  { key: 'nicolas', name: 'Nicolás Acosta', email: 'nicolas.acosta@example.com', phone: '+598 99 000 110' },
];
const GUESTS = [
  { key: 'paula', name: 'Paula Rivero', email: 'paula.rivero@example.com', phone: '+598 99 000 111' },
  { key: 'mateo', name: 'Mateo Lemos', email: 'mateo.lemos@example.com', phone: '+598 99 000 112' },
];

// Días atrás con asistencia (solo se usan los días hábiles; los turnos de Performance son de lunes a viernes).
const HISTORY = {
  sofia: { time: '19:00', days: [1, 3, 6, 8, 10, 13, 15, 17, 20, 22, 24, 27, 29, 31, 34, 36, 38, 41, 43, 45], absent: [8], noShow: [22] },
  martin: { time: '19:00', days: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32, 35, 37, 42, 44] },
  federico: { time: '20:00', days: [1, 3, 5, 8, 10, 12, 15, 17, 19, 22, 24, 26, 29, 31, 33, 36, 38, 40, 43, 45] },
  diego: {
    time: '19:00',
    days: [3, 15, 17, 19, 22, 24, 26, 29, 31, 33, 36, 38, 40, 43, 45, 47, 50, 52, 54, 57, 59, 61, 64, 66, 68],
  },
  lucia: { time: '07:00', days: [2, 4, 7, 9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32] },
  andres: { time: '18:00', days: [6, 8, 10, 13, 15, 17, 20, 22, 24, 27] },
  camila: { time: '18:00', days: [26, 28, 30, 33, 35, 37, 40, 42, 44, 47, 49, 51] },
  valentina: { time: '08:00', days: [9, 11, 14, 16, 18, 21, 23, 25, 28, 30, 32, 35] },
  joaquin: { time: '17:00', days: [13, 15, 17, 20, 22, 24, 27, 29] },
};

// Vigencia que se le da a cada plan de Performance comprado hoy: fecha de vencimiento = hoy + N días.
const ENDS_IN_DAYS = { sofia: 55, martin: 12, lucia: 4, andres: -5, camila: 50, joaquin: 9, valentina: 45, federico: 20, diego: 18 };

const step = (message) => console.log(`• ${message}`);

class ApiError extends Error {
  constructor(method, path, status, code) {
    super(`${method} ${path} → ${status}${code ? ` ${code}` : ''}`);
    this.status = status;
    this.code = code;
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

function readEnvFile(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

// ---------- fechas de negocio (America/Montevideo) ----------

function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(date);
}

function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekday(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function localTime(iso) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

const minutesOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

// ---------- HTTP ----------

function cookiesFrom(response, previous = '') {
  const jar = new Map(previous.split('; ').filter(Boolean).map((pair) => [pair.split('=')[0], pair]));
  for (const header of response.headers.getSetCookie()) {
    const pair = header.split(';')[0];
    jar.set(pair.split('=')[0], pair);
  }
  return [...jar.values()].join('; ');
}

async function request(session, method, path, body) {
  const headers = { origin: WEB_URL };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (session?.cookie) headers.cookie = session.cookie;
  const response = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (session) session.cookie = cookiesFrom(response, session.cookie);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new ApiError(method, path, response.status, data?.code);
  return data;
}

async function signIn(email, password) {
  const session = { cookie: '' };
  await request(session, 'POST', '/auth/sign-in/email', { email, password });
  return session;
}

async function signUp(client, password) {
  const session = { cookie: '' };
  await request(session, 'POST', '/auth/sign-up/email', { name: client.name, email: client.email, password, phone: client.phone });
  if (!session.cookie) return signIn(client.email, password);
  return session;
}

// ---------- SQL (solo historia: ver comentario del encabezado) ----------

function createSql(dbName, dbUser) {
  return function sql(statement) {
    const result = spawnSync(
      'docker',
      ['exec', '-i', DB_CONTAINER, 'psql', '-U', dbUser, '-d', dbName, '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'],
      { input: statement, encoding: 'utf8' },
    );
    if (result.status !== 0) throw new Error('No se pudo ejecutar SQL de historia (¿está levantado el contenedor de Postgres?).');
    return result.stdout.trim();
  };
}

const UUID = /^[0-9a-f-]{36}$/;
const assertUuid = (value) => {
  if (!UUID.test(value)) throw new Error('Identificador inesperado.');
  return value;
};

// ---------- agenda ----------

async function findSlot(session, service, { fromDay = 0, minHoursAhead = 0, time, days = 14 }) {
  const today = businessDate();
  for (let offset = fromDay; offset < fromDay + days; offset += 1) {
    const date = addDays(today, offset);
    const slots = await request(session, 'GET', `/schedule/time-slots?service=${service}&date=${date}`);
    const slot = slots.find(
      (item) =>
        item.available > 0 &&
        new Date(item.startsAt).getTime() - Date.now() >= minHoursAhead * MS_HOUR &&
        (time === undefined || localTime(item.startsAt) === time),
    );
    if (slot) return slot;
  }
  throw new Error(`No hay turnos de ${service} disponibles para la demostración.`);
}

// ---------- pasos ----------

async function assertEmpty(staff) {
  const existing = await request(staff, 'GET', '/staff/clients?q=example.com&pageSize=100');
  const demoEmails = new Set([...CLIENTS, ...GUESTS].map((client) => client.email));
  if (existing.items.some((client) => demoEmails.has(client.email))) {
    throw new Error('Ya hay datos de demostración en esta base: no se cargan de nuevo. Usá una base recién migrada y con seed.');
  }
}

async function buyPlan(session, plan) {
  const checkout = await request(session, 'POST', '/checkout/plan', { planId: plan.id });
  await request(null, 'POST', '/payments/dev/simulate', { externalReference: checkout.externalReference, outcome: 'approved' });
}

async function guestPurchase(guest, plan, slot) {
  const checkout = await request(null, 'POST', '/checkout/booking', {
    planId: plan.id,
    timeSlotId: slot.id,
    guest: { name: guest.name, email: guest.email, phone: guest.phone },
  });
  await request(null, 'POST', '/payments/dev/simulate', { externalReference: checkout.externalReference, outcome: 'approved' });
}

function historyRows(today) {
  const rows = [];
  for (const [key, history] of Object.entries(HISTORY)) {
    const email = CLIENTS.find((client) => client.key === key).email;
    for (const daysAgo of history.days) {
      const date = addDays(today, -daysAgo);
      if (weekday(date) === 0 || weekday(date) === 6) continue;
      const status = history.absent?.includes(daysAgo) ? 'absent' : history.noShow?.includes(daysAgo) ? 'no_show' : 'present';
      rows.push({ email, date, time: history.time, status });
    }
  }
  return rows;
}

// Turnos de hoy que ya empezaron (o, si es muy temprano, los últimos de ayer) con asistencias marcadas y una pendiente.
function recentSlotRows(today) {
  const times = ['07:00', '08:00', '09:00', '17:00', '18:00', '19:00', '20:00', '21:00'];
  const nowMinutes = minutesOf(localTime(new Date().toISOString()));
  const startedToday = times.filter((time) => minutesOf(time) <= nowMinutes - 60);
  const day = startedToday.length >= 2 ? today : addDays(today, -1);
  const pool = startedToday.length >= 2 ? startedToday : ['19:00', '20:00'];
  const [later, earlier] = [pool[pool.length - 1], pool[pool.length - 2]];
  const rows = (email, time, status) => ({ email, date: day, time, status });
  const byKey = (key) => CLIENTS.find((client) => client.key === key).email;
  return [
    rows(byKey('sofia'), later, 'present'),
    rows(byKey('martin'), later, 'present'),
    rows(byKey('federico'), later, 'absent'),
    rows(byKey('diego'), later, 'no_show'),
    rows(byKey('lucia'), later, 'pending'),
    rows(byKey('diego'), earlier, 'present'),
  ].filter((row, index, all) => !all.slice(0, index).some((prev) => prev.email === row.email && prev.time === row.time));
}

function insertAttendanceSql(rows, staffId) {
  const values = rows.map((row) => `('${row.email}', '${row.date}'::date, '${row.time}'::time, '${row.status}')`).join(',\n');
  const startsAt = `((h.d + h.t) AT TIME ZONE '${BUSINESS_TZ}')`;
  return `
BEGIN;
CREATE TEMP TABLE h (email text, d date, t time, status text) ON COMMIT DROP;
INSERT INTO h VALUES ${values};
INSERT INTO time_slots (service, starts_at, ends_at, capacity)
  SELECT DISTINCT 'performance', ${startsAt}, ${startsAt} + interval '60 minutes', 14 FROM h
  WHERE NOT EXISTS (SELECT 1 FROM time_slots s WHERE s.service = 'performance' AND s.starts_at = ${startsAt});
WITH created AS (
  INSERT INTO bookings (user_id, time_slot_id, status, source, subscription_id, confirmed_at, created_at)
  SELECT u.id, s.id, 'confirmed', 'plan', sub.id, s.starts_at - interval '1 day', s.starts_at - interval '1 day'
  FROM h
  JOIN users u ON u.email = h.email
  JOIN time_slots s ON s.service = 'performance' AND s.starts_at = ${startsAt}
  LEFT JOIN LATERAL (
    SELECT id FROM subscriptions WHERE user_id = u.id AND service = 'performance' AND deleted_at IS NULL ORDER BY ends_on DESC LIMIT 1
  ) sub ON true
  RETURNING id, user_id, time_slot_id
)
INSERT INTO attendances (booking_id, status, marked_by, marked_at)
  SELECT c.id, h.status, '${assertUuid(staffId)}', s.starts_at + interval '70 minutes'
  FROM created c
  JOIN users u ON u.id = c.user_id
  JOIN time_slots s ON s.id = c.time_slot_id
  JOIN h ON h.email = u.email AND s.starts_at = ${startsAt}
  WHERE h.status <> 'pending';
COMMIT;`;
}

// Mueve la vigencia (y las fechas de la compra) para que la suscripción de Performance vença en `endsOn`.
function shiftSubscriptionSql(email, endsOn) {
  return `
WITH target AS (
  SELECT s.id, s.purchase_id, (s.ends_on - '${endsOn}'::date) AS n
  FROM subscriptions s JOIN users u ON u.id = s.user_id
  WHERE u.email = '${email}' AND s.service = 'performance' AND s.deleted_at IS NULL
  ORDER BY s.ends_on DESC LIMIT 1
), moved AS (
  UPDATE subscriptions s SET starts_on = s.starts_on - t.n, ends_on = s.ends_on - t.n FROM target t WHERE s.id = t.id RETURNING t.purchase_id, t.n
)
UPDATE purchases p SET created_at = p.created_at - (m.n || ' days')::interval, approved_at = p.approved_at - (m.n || ' days')::interval
  FROM moved m WHERE p.id = m.purchase_id;`;
}

async function main() {
  const staffPassword = requireEnv('MANUAL_STAFF_PASSWORD');
  const clientPassword = requireEnv('MANUAL_CLIENT_PASSWORD');
  if (clientPassword.length < 8) throw new Error('MANUAL_CLIENT_PASSWORD debe tener al menos 8 caracteres.');

  const apiEnv = readEnvFile(resolve(ROOT, 'apps/api/.env'));
  const sql = createSql(apiEnv.DB_NAME, apiEnv.DB_USER ?? 'move');
  const today = businessDate();

  step('Ingresando como staff');
  const staff = await signIn(STAFF_EMAIL, staffPassword);
  const me = await request(staff, 'GET', '/me');
  await assertEmpty(staff);

  const plans = new Map((await request(null, 'GET', '/catalog/plans')).map((plan) => [plan.slug, plan]));
  const plan = (slug) => {
    const found = plans.get(slug);
    if (!found) throw new Error(`Falta el plan ${slug}: corré el seed.`);
    return found;
  };

  step(`Registrando ${CLIENTS.length} clientes`);
  const sessions = {};
  const ids = {};
  for (const client of CLIENTS) {
    sessions[client.key] = await signUp(client, clientPassword);
    ids[client.key] = (await request(sessions[client.key], 'GET', '/me')).id;
  }

  step('Comprando planes con el simulador de pagos');
  await buyPlan(sessions.sofia, plan('performance-trimestral'));
  await buyPlan(sessions.sofia, plan('recovery-paquete-4'));
  await buyPlan(sessions.martin, plan('performance-mensual'));
  await buyPlan(sessions.lucia, plan('performance-mensual'));
  await buyPlan(sessions.andres, plan('performance-mensual'));
  await buyPlan(sessions.camila, plan('performance-trimestral'));
  await buyPlan(sessions.joaquin, plan('performance-mensual'));
  await buyPlan(sessions.federico, plan('performance-mensual'));

  step('Registrando pagos manuales (efectivo y transferencia)');
  const manual = (key, slug, method, note) =>
    request(staff, 'POST', '/staff/payments/manual', { userId: ids[key], planId: plan(slug).id, method, amount: plan(slug).price, note });
  await manual('diego', 'performance-mensual', 'cash', 'Pago en recepción');
  await manual('valentina', 'performance-trimestral', 'transfer', 'Transferencia bancaria');

  step('Compras de invitados: evaluación Rehab y sesión Recovery');
  const rehabSlot = await findSlot(null, 'rehab', { fromDay: 1 });
  await guestPurchase(GUESTS[0], plan('rehab-evaluacion'), rehabSlot);
  const recoverySlot = await findSlot(null, 'recovery', { fromDay: 1 });
  await guestPurchase(GUESTS[1], plan('recovery-sesion'), recoverySlot);

  step('Ajustando vigencias e historia de asistencias');
  for (const [key, endsInDays] of Object.entries(ENDS_IN_DAYS)) {
    const email = CLIENTS.find((client) => client.key === key).email;
    sql(shiftSubscriptionSql(email, addDays(today, endsInDays)));
  }
  sql(insertAttendanceSql([...historyRows(today), ...recentSlotRows(today)], me.id));

  step('Reservas Performance (hoy y próximos días), Recovery y una cancelación');
  const evening = await findSlot(sessions.sofia, 'performance', { fromDay: 0, minHoursAhead: 3, time: '19:00' });
  for (const key of ['sofia', 'martin', 'federico', 'diego', 'lucia']) {
    await request(sessions[key], 'POST', '/bookings', { timeSlotId: evening.id });
  }
  const tomorrowMorning = await findSlot(sessions.sofia, 'performance', { fromDay: 1, time: '07:00' });
  await request(sessions.sofia, 'POST', '/bookings', { timeSlotId: tomorrowMorning.id });
  await request(sessions.martin, 'POST', '/bookings', { timeSlotId: tomorrowMorning.id });
  const lateSlot = await findSlot(sessions.martin, 'performance', { fromDay: 1, time: '20:00' });
  const cancelled = await request(sessions.martin, 'POST', '/bookings', { timeSlotId: lateSlot.id });
  await request(sessions.martin, 'POST', `/bookings/${cancelled.id}/cancel`);
  const nextWeek = await findSlot(sessions.camila, 'performance', { fromDay: 3, time: '18:00' });
  await request(sessions.camila, 'POST', '/bookings', { timeSlotId: nextWeek.id });
  const packSlot = await findSlot(sessions.sofia, 'recovery', { fromDay: 1, time: '18:30' });
  await request(sessions.sofia, 'POST', '/bookings', { timeSlotId: packSlot.id });

  step('Pausa por lesión (Joaquín)');
  await request(staff, 'POST', `/staff/clients/${ids.joaquin}/inactivity-reasons`, {
    reason: 'injury',
    note: 'Lesión de rodilla: vuelve cuando lo habilite el médico.',
    recontactOn: today,
  });

  step('Detección de alertas y recordatorios de vencimiento');
  await request(staff, 'POST', '/staff/automations/run/followup-detect');
  await request(staff, 'POST', '/staff/automations/run/expiry-reminders');

  step('Check-ins del mes: envío y respuestas (una con molestia)');
  await request(staff, 'POST', '/staff/checkins/send');
  const answers = {
    sofia: { feeling: 'very_good', pain: 'none', goals: 'same' },
    martin: { feeling: 'good', pain: 'none', goals: 'same' },
    federico: { feeling: 'struggling', pain: 'mild', painDetail: 'Molestia en el hombro derecho al hacer press.', goals: 'same' },
    diego: { feeling: 'good', pain: 'none', goals: 'adjust', goalsDetail: 'Quiero sumar más trabajo de fuerza.' },
  };
  for (const [key, answer] of Object.entries(answers)) {
    const { checkin } = await request(sessions[key], 'GET', '/me/checkins/pending');
    if (checkin) await request(sessions[key], 'POST', `/me/checkins/${checkin.id}`, answer);
  }

  step('Derivar a Rehab a Federico y reservar su seguimiento');
  const responses = await request(staff, 'GET', '/staff/checkins/responses?flag=pain');
  const painResponse = responses.find((response) => response.client.id === ids.federico);
  if (painResponse) await request(staff, 'POST', `/staff/checkins/${painResponse.id}/refer-rehab`);
  await request(staff, 'PATCH', `/staff/clients/${ids.federico}/rehab-followup`, { enabled: true });
  const followupSlot = await findSlot(sessions.federico, 'rehab', { fromDay: 2 });
  await request(sessions.federico, 'POST', '/bookings', { timeSlotId: followupSlot.id });

  step('Contactos del staff sobre las alertas');
  const alerts = await request(staff, 'GET', '/staff/alerts');
  const alertFor = (key, type) => alerts.find((alert) => alert.client.id === ids[key] && alert.type === type);
  const inactivity = alertFor('camila', 'prolonged_inactivity');
  if (inactivity) {
    await request(staff, 'POST', `/staff/alerts/${inactivity.id}/contacts`, {
      channel: 'whatsapp', outcome: 'no_answer', note: 'Se le escribió por WhatsApp, sin respuesta.',
    });
  }
  const noAttendance = alertFor('valentina', 'no_attendance');
  if (noAttendance) {
    await request(staff, 'POST', `/staff/alerts/${noAttendance.id}/contacts`, {
      channel: 'phone', outcome: 'reached', note: 'Estuvo de viaje; vuelve esta semana.',
    });
    await request(staff, 'POST', `/staff/alerts/${noAttendance.id}/handle`);
  }

  console.log('\nListo. Datos de demostración cargados.');
  console.log(`Staff: ${STAFF_EMAIL} (contraseña: variable MANUAL_STAFF_PASSWORD)`);
  console.log('Clientes (contraseña: variable MANUAL_CLIENT_PASSWORD):');
  for (const client of CLIENTS) console.log(`  - ${client.name} <${client.email}>`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
