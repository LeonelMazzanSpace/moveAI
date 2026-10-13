// Flujo 7: panel de staff. Dashboard, clientes (búsqueda, alta, detalle, pausa), turnos y asistencia, pagos (filtros y
// pago manual), seguimiento (alertas y contacto), check-ins (derivar a Rehab) y configuración.
import type { Locator, Page } from '@playwright/test';
import type { ClientDetailDto, StaffTimeSlotDto } from '../apps/web/src/lib/api/types';
import { type Client, expect, staffCredentials, test, uniquePerson } from './fixtures';
import type { ApiClient } from './support/api';
import { moveSlotBack } from './support/sql';
import { businessDate } from './support/time';

// Tarjeta (alerta o respuesta de check-in) del cliente: el bloque más interno que tiene su nombre y el botón pedido.
function cardOf(page: Page, name: string, button: string): Locator {
  return page
    .locator('div')
    .filter({ has: page.getByText(name, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: button, exact: true }) })
    .last();
}

// Un cliente con plan que responde el check-in del mes con una molestia.
async function clientWithPainCheckin(staff: ApiClient, createClient: () => Promise<Client>): Promise<Client> {
  const client = await createClient();
  await staff.call('POST', '/staff/checkins/send');
  const { checkin } = await client.api.call<{ checkin: { id: string } | null }>('GET', '/me/checkins/pending');
  if (!checkin) throw new Error('El cliente no recibió el check-in.');
  await client.api.call('POST', `/me/checkins/${checkin.id}`, {
    feeling: 'good',
    pain: 'mild',
    painDetail: 'Molestia en el hombro',
    goals: 'same',
  });
  return client;
}

test.describe('Staff', () => {
  test.beforeEach(async ({ page, login }) => {
    await login(page, staffCredentials());
  });

  test('dashboard y navegación por todas las secciones', async ({ page, ui }) => {
    await ui.visit('/staff');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Alertas abiertas/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Turnos de hoy' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Clientes activos' })).toBeVisible();

    const sections = [
      { label: 'Clientes', path: '/staff/clientes', heading: 'Clientes' },
      { label: 'Turnos y asistencia', path: '/staff/turnos', heading: 'Turnos y asistencia' },
      { label: 'Pagos', path: '/staff/pagos', heading: 'Pagos' },
      { label: 'Seguimiento', path: '/staff/seguimiento', heading: 'Seguimiento y retención' },
      { label: 'Check-in', path: '/staff/seguimiento/check-in', heading: 'Check-in de clientes' },
      { label: 'Configuración', path: '/staff/configuracion', heading: 'Configuración' },
      { label: 'Dashboard', path: '/staff', heading: 'Dashboard' },
    ];
    for (const section of sections) {
      await ui.navigate(section.label, 'staff');
      await expect(page).toHaveURL(new RegExp(`${section.path}(\\?.*)?$`));
      await expect(page.getByRole('heading', { level: 1, name: section.heading })).toBeVisible();
      await ui.expectFits();
    }
  });

  test('clientes: búsqueda, detalle y pausa', async ({ page, ui, createClient }) => {
    const client = await createClient({ plan: 'performance-mensual' });

    await ui.visit('/staff/clientes');
    await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(client.name);
    await expect(page).toHaveURL(/q=/);
    await page.getByRole('link', { name: client.name }).click();
    await page.waitForURL(`/staff/clientes/${client.id}`);
    await expect(page.getByRole('heading', { level: 2, name: client.name })).toBeVisible();
    await expect(page.getByRole('main').getByText(client.email).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan y paquetes' })).toBeVisible();
    await ui.expectFits();

    await page.getByRole('button', { name: 'Registrar motivo' }).click();
    await expect(page.getByText('Elegí un motivo.')).toBeVisible();
    await page.getByRole('group', { name: 'Motivo' }).getByRole('button', { name: 'Lesión' }).click();
    await page.getByLabel('Nota interna (opcional)').fill('Lesión de tobillo');
    await page.getByRole('button', { name: 'Registrar motivo' }).click();
    await expect(page.getByText('Motivo registrado')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pausa activa' })).toBeVisible();

    await page.getByRole('button', { name: 'Finalizar pausa' }).click();
    const dialog = page.getByRole('dialog', { name: 'Finalizar pausa' });
    await dialog.getByRole('button', { name: 'Sí, finalizar' }).click();
    await expect(page.getByText('Pausa finalizada')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Registrar motivo' })).toBeVisible();
  });

  test('clientes: alta de un cliente nuevo', async ({ page, ui }) => {
    const person = uniquePerson('Sofía');
    await ui.visit('/staff/clientes');
    await page.getByRole('link', { name: 'Nuevo cliente' }).click();
    await page.waitForURL('/staff/clientes/nuevo');
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page.getByText('Ingresá el nombre (mínimo 2 caracteres).')).toBeVisible();

    await page.getByLabel('Nombre y apellido').fill(person.name);
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Teléfono (opcional)').fill('099 111 222');
    await ui.expectFits();
    await page.getByRole('button', { name: 'Crear cliente' }).click();
    await expect(page.getByText('Cliente creado. Le enviamos un email para activar su cuenta.')).toBeVisible();
    await page.waitForURL(/\/staff\/clientes\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 2, name: person.name })).toBeVisible();
  });

  test('turnos y asistencia: presente, ausente y no show', async ({ page, ui, createClient, createSlot, staff }) => {
    const clients = await Promise.all([1, 2, 3].map(() => createClient({ plan: 'performance-mensual' })));
    const slot = await createSlot({ service: 'performance', capacity: 5 });
    for (const client of clients) await client.api.call('POST', '/bookings', { timeSlotId: slot.id });
    // La asistencia se marca desde el día del turno: se lo trae a hoy.
    const today = businessDate();
    moveSlotBack(slot.id, Math.round((Date.parse(slot.date) - Date.parse(today)) / 86_400_000));

    await ui.visit(`/staff/turnos?fecha=${today}&servicio=performance&turno=${slot.id}`);
    await expect(page.getByRole('heading', { name: `Turno ${slot.time} — Performance` })).toBeVisible();
    const marks = [
      { client: clients[0], status: 'Presente', badge: 'Presente' },
      { client: clients[1], status: 'Ausente', badge: 'Ausente' },
      { client: clients[2], status: 'No show', badge: 'No show' },
    ];
    for (const mark of marks) {
      const row = page.getByRole('row', { name: new RegExp(mark.client.name) });
      await row.getByRole('button', { name: mark.status, exact: true }).click();
      await expect(row.getByRole('button', { name: mark.status, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    await ui.expectFits();

    await page.reload();
    for (const mark of marks) {
      const row = page.getByRole('row', { name: new RegExp(mark.client.name) });
      await expect(row.getByRole('button', { name: mark.status, exact: true })).toHaveAttribute('aria-pressed', 'true');
    }
    const slots = await staff.call<StaffTimeSlotDto[]>('GET', `/staff/time-slots?date=${today}&service=performance`);
    const marked = slots.find((item) => item.id === slot.id);
    expect(marked).toMatchObject({ booked: 3, present: 1, absent: 1, noShow: 1, pendingAttendance: 0 });
  });

  test('pagos: pago manual y filtros', async ({ page, ui, createClient }) => {
    const client = await createClient();

    await ui.visit('/staff/pagos');
    const dialog = page.getByRole('dialog', { name: 'Registrar pago manual' });
    await ui.clickUntil(page.getByRole('button', { name: 'Registrar pago manual' }), dialog);
    await dialog.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(dialog.getByText('Elegí un cliente.')).toBeVisible();

    await dialog.getByPlaceholder('Buscá por nombre o email').fill(client.name);
    await dialog.getByRole('button', { name: new RegExp(client.name) }).click();
    await expect(dialog.getByText(`Seleccionado: ${client.name}`)).toBeVisible();
    await dialog.getByLabel('Plan').selectOption({ label: 'Performance · Plan Mensual · $ 3.900' });
    await expect(dialog.getByLabel('Monto (UYU)')).toHaveValue('3900');
    await dialog.getByLabel('Método').selectOption('transfer');
    await dialog.getByLabel('Nota (opcional)').fill('Transferencia E2E');
    await ui.expectFits();
    await dialog.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByText('Pago registrado.')).toBeVisible();
    await expect(dialog).toBeHidden();

    await page.getByLabel('Método').selectOption('transfer');
    await expect(page).toHaveURL(/metodo=transfer/);
    await page.getByLabel('Estado').selectOption('approved');
    await expect(page).toHaveURL(/estado=approved/);
    await expect(page.getByRole('row', { name: new RegExp(client.name) })).toContainText('Transferencia');
    await page.getByLabel('Método').selectOption('cash');
    await expect(page).toHaveURL(/metodo=cash/);
    await expect(page.getByRole('row', { name: new RegExp(client.name) })).toHaveCount(0);
  });

  test('seguimiento: contacto y alerta gestionada', async ({ page, ui, staff, createClient }) => {
    const client = await clientWithPainCheckin(staff, () => createClient({ plan: 'performance-mensual' }));

    await ui.visit('/staff/seguimiento?tipo=checkin_pain');
    await expect(page.getByRole('heading', { level: 1, name: 'Seguimiento y retención' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filtrar alertas' }).getByRole('button', { name: /^Molestia reportada/ })).toHaveAttribute('aria-pressed', 'true');
    const card = cardOf(page, client.name, 'Contactar');
    await card.getByRole('button', { name: 'Contactar', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: `Contactar a ${client.name}` });
    await dialog.getByRole('group', { name: 'Canal' }).getByRole('button', { name: 'Teléfono' }).click();
    await dialog.getByRole('group', { name: 'Resultado' }).getByRole('button', { name: 'No respondió' }).click();
    await dialog.getByLabel('Nota').fill('Llamado sin respuesta');
    await ui.expectFits();
    await dialog.getByRole('button', { name: 'Guardar contacto' }).click();
    await expect(page.getByText('Contacto registrado')).toBeVisible();
    await expect(dialog).toBeHidden();

    await cardOf(page, client.name, 'Marcar gestionado').getByRole('button', { name: 'Marcar gestionado' }).click();
    await expect(page.getByText('Alerta marcada como gestionada')).toBeVisible();
    await expect(page.getByText(client.name, { exact: true })).toHaveCount(0);

    const detail = await staff.call<ClientDetailDto>('GET', `/staff/clients/${client.id}`);
    expect(detail.contacts[0]).toMatchObject({ channel: 'phone', outcome: 'no_answer', note: 'Llamado sin respuesta' });
  });

  test('check-ins: derivar a Rehab habilita el seguimiento', async ({ page, ui, staff, createClient }) => {
    const client = await clientWithPainCheckin(staff, () => createClient({ plan: 'performance-mensual' }));

    await ui.visit('/staff/seguimiento/check-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Check-in de clientes' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Respondidos' })).toBeVisible();
    const card = cardOf(page, client.name, 'Derivar a Rehab');
    await expect(card).toContainText('Molestia en el hombro');
    await card.getByRole('button', { name: 'Derivar a Rehab' }).click();
    await expect(page.getByText('Derivado a Rehab').first()).toBeVisible();
    await expect(card.getByRole('button', { name: 'Derivado a Rehab' })).toBeDisabled();
    await ui.expectFits();

    const detail = await staff.call<ClientDetailDto>('GET', `/staff/clients/${client.id}`);
    expect(detail.client.rehabFollowupEnabled).toBe(true);
  });

  test('configuración: planes, horarios, profesionales y reglas', async ({ page, ui, staff }) => {
    const tag = uniquePerson().email.split('.')[1].split('@')[0];

    await ui.visit('/staff/configuracion?tab=planes');
    const tabs = page.getByRole('navigation', { name: 'Secciones de configuración' });
    const planDialog = page.getByRole('dialog', { name: 'Nuevo plan' });
    await ui.clickUntil(page.getByRole('button', { name: 'Nuevo plan' }), planDialog);
    await planDialog.getByLabel('Servicio').selectOption('performance');
    await planDialog.getByLabel('Nombre').fill(`Plan E2E ${tag}`);
    await planDialog.getByLabel('Identificador').fill(`plan-e2e-${tag}`);
    await planDialog.getByLabel('Precio (UYU)').fill('1500');
    await planDialog.getByLabel('Meses').fill('1');
    await planDialog.getByLabel('Activo').uncheck();
    await ui.expectFits();
    await planDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Plan creado.')).toBeVisible();
    const planRow = page.getByRole('row', { name: new RegExp(`Plan E2E ${tag}`) });
    await expect(planRow).toContainText('Inactivo');
    await planRow.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog', { name: 'Eliminar plan' }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Plan eliminado.')).toBeVisible();
    await expect(planRow).toHaveCount(0);

    await tabs.getByRole('link', { name: 'Horarios' }).click();
    await expect(page).toHaveURL(/tab=horarios/);
    const slotDialog = page.getByRole('dialog', { name: 'Turno puntual' });
    await ui.clickUntil(page.getByRole('button', { name: 'Turno puntual' }), slotDialog);
    const date = businessDate(new Date(Date.now() + 3 * 86_400_000));
    const time = `05:${String(10 + Math.floor(Math.random() * 49)).padStart(2, '0')}`;
    await slotDialog.getByLabel('Servicio').selectOption('performance');
    await slotDialog.getByLabel('Fecha').fill(date);
    await slotDialog.getByLabel('Hora').fill(time);
    await slotDialog.getByLabel('Cupo').fill('6');
    await slotDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Turno creado.')).toBeVisible();
    const slots = await staff.call<StaffTimeSlotDto[]>('GET', `/staff/time-slots?date=${date}&service=performance`);
    expect(slots.some((slot) => slot.capacity === 6)).toBe(true);

    await tabs.getByRole('link', { name: 'Profesionales' }).click();
    await expect(page).toHaveURL(/tab=profesionales/);
    const professional = `Profesional ${tag}`;
    await page.getByLabel('Nombre del profesional').fill(professional);
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByText('Profesional agregado.')).toBeVisible();
    const professionalRow = page.getByRole('row', { name: new RegExp(professional) });
    await expect(professionalRow).toContainText('Activo');
    await professionalRow.getByRole('button', { name: 'Desactivar' }).click();
    await expect(professionalRow).toContainText('Inactivo');

    await tabs.getByRole('link', { name: 'Reglas' }).click();
    await expect(page).toHaveURL(/tab=reglas/);
    await expect(page.getByText('Valores provisorios — confirmar con MOVE')).toBeVisible();
    // Un ajuste que no usa ninguna otra prueba (la conciliación no corre: SCHEDULER_ENABLED=false).
    const reconcile = page.getByLabel('Minutos para conciliar pagos');
    const next = (await reconcile.inputValue()) === '15' ? '20' : '15';
    await reconcile.fill(next);
    await ui.expectFits();
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Reglas guardadas.')).toBeVisible();
  });
});
