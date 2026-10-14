// Fixtures comunes: cada prueba crea sus propios clientes, turnos y compras por la API, así no depende del orden de
// ejecución ni de lo que hagan las demás (corren en paralelo, en desktop y mobile, contra la misma base).
import { randomBytes } from 'node:crypto';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { CheckoutResponseDto, MeDto, PlanDto, ProfessionalDto, Service, StaffTimeSlotDto } from '../apps/web/src/lib/api/types';
import { E2E_API_ORIGIN, E2E_API_URL, E2E_PROFESSIONAL_NAME, E2E_STAFF_EMAIL, E2E_WEB_URL, requireEnv } from '../scripts/e2e/env.mjs';
import { ApiClient, fakeIp } from './support/api';
import { addDays, businessDate, businessTime } from './support/time';

export { expect };

export interface Client {
  id: string;
  name: string;
  firstName: string;
  email: string;
  password: string;
  api: ApiClient;
}

export interface SlotRequest {
  service: Service;
  capacity?: number;
  date?: string;
  time?: string;
  durationMinutes?: number;
}

export interface Slot extends StaffTimeSlotDto {
  date: string;
  time: string;
}

interface Fixtures {
  isMobile: boolean;
  staff: ApiClient;
  createClient: (options?: { plan?: string; firstName?: string }) => Promise<Client>;
  createSlot: (request: SlotRequest) => Promise<Slot>;
  login: (page: Page, user: { email: string; password: string }) => Promise<void>;
  ui: Ui;
}

export const clientPassword = () => requireEnv('E2E_CLIENT_PASSWORD');
export const staffCredentials = () => ({ email: E2E_STAFF_EMAIL, password: requireEnv('E2E_STAFF_PASSWORD') });

const letters = (count: number) =>
  Array.from(randomBytes(count), (byte) => String.fromCharCode(97 + (byte % 26))).join('');

// Nombre y email únicos y fáciles de buscar: "Ana Qwerty" / ana.qwertyzx@example.com.
const ascii = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function uniquePerson(firstName = 'Ana') {
  const tag = letters(8);
  const last = `${tag.charAt(0).toUpperCase()}${tag.slice(1)}`;
  return { firstName, name: `${firstName} ${last}`, email: `${ascii(firstName)}.${tag}@example.com` };
}

// Horario único por prueba (día y minuto) para que dos pruebas en paralelo nunca compartan turno ni se confundan al
// elegirlo por hora: días 2–11 desde hoy, entre las 06:01 y las 20:59, nunca en :00 ni en :30 (las plantillas del seed
// son en punto, y Recovery también a las 18:30 y 19:30).
const SLOT_MINUTES = Array.from({ length: 59 }, (_, index) => index + 1).filter((minute) => minute !== 30);
let slotCounter = 0;
function uniqueSlotMoment(): { date: string; time: string } {
  const key = base.info().workerIndex * 211 + slotCounter++;
  const minute = SLOT_MINUTES[key % SLOT_MINUTES.length];
  const hour = 6 + (Math.floor(key / SLOT_MINUTES.length) % 15);
  const day = 2 + (Math.floor(key / (SLOT_MINUTES.length * 15)) % 10);
  return { date: addDays(businessDate(), day), time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

// Un horario de uniqueSlotMoment que ningún turno activo del servicio ocupa todavía: una corrida sin `pnpm e2e:reset` en el
// medio no se tropieza con los turnos que dejó la anterior (dos botones con la misma hora rompen los selectores).
async function freeSlotMoment(staff: ApiClient, service: Service): Promise<{ date: string; time: string }> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const moment = uniqueSlotMoment();
    const slots = await staff.call<StaffTimeSlotDto[]>('GET', `/staff/time-slots?date=${moment.date}&service=${service}`);
    const taken = slots.some((slot) => slot.cancelledAt === null && businessTime(new Date(slot.startsAt)) === moment.time);
    if (!taken) return moment;
  }
  throw new Error(`No hay un horario libre para un turno de ${service}: corré pnpm e2e:reset.`);
}

export async function buyPlan(api: ApiClient, slug: string): Promise<void> {
  const plan = await api.call<PlanDto>('GET', `/catalog/plans/${slug}`);
  const checkout = await api.call<CheckoutResponseDto>('POST', '/checkout/plan', { planId: plan.id });
  await api.call('POST', '/payments/dev/simulate', { externalReference: checkout.externalReference, outcome: 'approved' });
}

export class Ui {
  constructor(
    readonly page: Page,
    readonly isMobile: boolean,
  ) {}

  // Navega con el menú del área: header (o sidebar de staff) en desktop, menú móvil en mobile.
  async navigate(label: string | RegExp, area: 'public' | 'client' | 'staff' = 'public'): Promise<void> {
    const name = typeof label === 'string' ? new RegExp(`^${label}`) : label;
    const link = (await this.menu(area)).getByRole('link', { name });
    await link.click();
    if (this.isMobile) await expect(this.page.getByRole('dialog', { name: 'Menú' })).toBeHidden();
  }

  // Contenedor del menú del área, abierto si es el móvil.
  async menu(area: 'public' | 'client' | 'staff' = 'public'): Promise<Locator> {
    if (!this.isMobile) {
      return area === 'staff' ? this.page.locator('aside').getByRole('navigation') : this.page.getByRole('banner').getByRole('navigation');
    }
    const dialog = this.page.getByRole('dialog', { name: 'Menú' });
    await expect(async () => {
      await this.page.getByRole('button', { name: 'Abrir menú' }).click();
      await expect(dialog).toBeVisible({ timeout: 2_000 });
    }).toPass();
    return dialog;
  }

  async logout(area: 'client' | 'staff'): Promise<void> {
    const scope = this.isMobile ? await this.menu(area) : this.page;
    await scope.getByRole('button', { name: 'Salir' }).click();
    await this.page.waitForURL(`${E2E_WEB_URL}/`);
  }

  async visit(path: string): Promise<void> {
    await this.page.goto(path);
    await this.expectFits();
  }

  // En mobile ninguna pantalla tiene scroll horizontal: el documento no es más ancho que el viewport.
  async expectFits(): Promise<void> {
    if (!this.isMobile) return;
    await this.page.waitForLoadState('networkidle');
    const overflow = await this.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `scroll horizontal en ${this.page.url()}`).toBeLessThanOrEqual(0);
  }

  // Hace clic hasta que aparece `target`: un clic antes de que React hidrate la página no hace nada.
  async clickUntil(button: Locator, target: Locator): Promise<void> {
    await expect(async () => {
      await button.click();
      await expect(target).toBeVisible({ timeout: 2_000 });
    }).toPass();
  }
}

export const test = base.extend<Fixtures>({
  isMobile: async ({}, use, testInfo) => {
    await use(testInfo.project.name === 'mobile');
  },

  // Cada contexto del navegador se presenta a la API con su propia IP (ver fakeIp).
  context: async ({ context }, use) => {
    const ip = fakeIp();
    await context.route(`${E2E_API_ORIGIN}/**`, (route) =>
      route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': ip } }),
    );
    await use(context);
  },

  staff: async ({}, use) => {
    const { email, password } = staffCredentials();
    const staff = await ApiClient.signIn(email, password);
    await use(staff);
    await staff.dispose();
  },

  createClient: async ({}, use) => {
    const created: ApiClient[] = [];
    await use(async ({ plan, firstName } = {}) => {
      const person = uniquePerson(firstName);
      const password = clientPassword();
      const api = await ApiClient.create();
      created.push(api);
      await api.call('POST', '/auth/sign-up/email', { name: person.name, email: person.email, password });
      const me = await api.call<MeDto>('GET', '/me');
      if (plan) await buyPlan(api, plan);
      return { ...person, id: me.id, password, api };
    });
    await Promise.all(created.map((api) => api.dispose()));
  },

  createSlot: async ({ staff }, use) => {
    let professionalId: string | undefined;
    await use(async ({ service, capacity = 1, date, time, durationMinutes = 60 }) => {
      const moment = date && time ? { date, time } : await freeSlotMoment(staff, service);
      if (service === 'rehab' && !professionalId) {
        const professionals = await staff.call<ProfessionalDto[]>('GET', '/staff/professionals');
        professionalId = professionals.find((professional) => professional.name === E2E_PROFESSIONAL_NAME)?.id;
        if (!professionalId) throw new Error('Falta el profesional de E2E: corré pnpm e2e:reset.');
      }
      const slot = await staff.call<StaffTimeSlotDto>('POST', '/staff/time-slots', {
        service,
        date: moment.date,
        startTime: moment.time,
        durationMinutes,
        capacity: service === 'rehab' ? 1 : capacity,
        ...(service === 'rehab' ? { professionalId } : {}),
      });
      return { ...slot, ...moment };
    });
  },

  // Inicia sesión por la API dentro del contexto del navegador: la cookie de sesión vale para la web.
  login: async ({}, use) => {
    await use(async (page, { email, password }) => {
      const response = await page.context().request.post(`${E2E_API_URL}/auth/sign-in/email`, {
        headers: { origin: E2E_WEB_URL, 'x-forwarded-for': fakeIp() },
        data: { email, password },
      });
      expect(response.ok(), `ingreso de ${email}`).toBe(true);
    });
  },

  ui: async ({ page, isMobile }, use) => {
    await use(new Ui(page, isMobile));
  },
});

// Fila de una tabla del staff por su texto. Usa el elemento <tr> y no el rol: debajo de `md` las tablas de turnos y pagos
// pasan a tarjetas (T-052) y pueden perder la semántica de tabla, pero siguen siendo filas del DOM.
export function rowOf(page: Page, text: string): Locator {
  return page.getByRole('main').locator('tr').filter({ hasText: text });
}
