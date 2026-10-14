// Flujo 7: panel de staff. Dashboard, clientes (búsqueda, alta, detalle, pausa), turnos y asistencia, pagos (filtros y
// pago manual), seguimiento (alertas y contacto), check-ins (derivar a Rehab) y configuración.
import type { Locator, Page } from '@playwright/test';
import type { ClientDetailDto, PublicSettingsDto, ScheduleTemplateDto, StaffTimeSlotDto } from '../apps/web/src/lib/api/types';
import { type Client, expect, rowOf, staffCredentials, test, uniquePerson } from './fixtures';
import type { ApiClient } from './support/api';
import { pickDayAndTime } from './support/booking';
import { moveSlotBack } from './support/sql';
import { addDays, businessDate, businessTime, isoWeekday } from './support/time';

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

// Turnos de Performance de los domingos a `time` dentro de la ventana de reserva: los que generó un horario semanal.
async function sundaySlotsAt(staff: ApiClient, time: string): Promise<StaffTimeSlotDto[]> {
  const { bookingWindowDays } = await staff.call<PublicSettingsDto>('GET', '/settings/public');
  const today = businessDate();
  const sundays = Array.from({ length: bookingWindowDays + 2 }, (_, offset) => addDays(today, offset)).filter(
    (date) => isoWeekday(date) === 7,
  );
  const days = await Promise.all(
    sundays.map((date) => staff.call<StaffTimeSlotDto[]>('GET', `/staff/time-slots?date=${date}&service=performance`)),
  );
  return days.flat().filter((slot) => businessTime(new Date(slot.startsAt)) === time);
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
    await expect(page.getByRole('link', { name: client.name })).toBeVisible();
    await ui.expectFits();
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
    await expect(dialog).toBeVisible();
    await ui.expectFits();
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
    await expect(page.getByText('Sin plan Performance vigente.')).toBeVisible();
    await ui.expectFits();
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
      { client: clients[0], status: 'Presente' },
      { client: clients[1], status: 'Ausente' },
      { client: clients[2], status: 'No show' },
    ];
    for (const mark of marks) {
      const button = rowOf(page, mark.client.name).getByRole('button', { name: mark.status, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await ui.expectFits();

    await page.reload();
    for (const mark of marks) {
      const button = rowOf(page, mark.client.name).getByRole('button', { name: mark.status, exact: true });
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    }
    await ui.expectFits();
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
    const payment = rowOf(page, client.name);
    await expect(payment).toContainText('Transferencia');
    await expect(payment).toContainText('$ 3.900');
    await ui.expectFits();

    // Con "Efectivo" la tabla termina en un estado conocido (vacía o solo con pagos en efectivo) y sin este pago.
    await page.getByLabel('Método').selectOption('cash');
    await expect(page).toHaveURL(/metodo=cash/);
    const cashRows = page.getByRole('main').locator('tbody tr');
    await expect(page.getByText('Sin pagos', { exact: true }).or(cashRows.filter({ hasText: 'Efectivo' }).first())).toBeVisible();
    await expect(cashRows.filter({ hasText: 'Transferencia' })).toHaveCount(0);
    await expect(payment).toHaveCount(0);
  });

  test('seguimiento: contacto y alerta gestionada', async ({ page, ui, staff, createClient }) => {
    const client = await clientWithPainCheckin(staff, () => createClient({ plan: 'performance-mensual' }));

    await ui.visit('/staff/seguimiento?tipo=checkin_pain');
    await expect(page.getByRole('heading', { level: 1, name: 'Seguimiento y retención' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Filtrar alertas' }).getByRole('button', { name: /^Molestia reportada/ })).toHaveAttribute('aria-pressed', 'true');
    const card = cardOf(page, client.name, 'Contactar');
    await expect(card).toBeVisible();
    await ui.expectFits();
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

  test('check-ins: derivar a Rehab habilita el seguimiento fisioterapéutico', async ({ page, ui, staff, createClient, createSlot, login }) => {
    const client = await clientWithPainCheckin(staff, () => createClient({ plan: 'performance-mensual' }));
    const slot = await createSlot({ service: 'rehab' });

    await ui.visit('/staff/seguimiento/check-in');
    await expect(page.getByRole('heading', { level: 1, name: 'Check-in de clientes' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Respondidos' })).toBeVisible();
    const card = cardOf(page, client.name, 'Derivar a Rehab');
    await expect(card).toContainText('Molestia en el hombro');
    await ui.expectFits();
    await card.getByRole('button', { name: 'Derivar a Rehab' }).click();
    await expect(page.getByText('Derivado a Rehab').first()).toBeVisible();
    await expect(card.getByRole('button', { name: 'Derivado a Rehab' })).toBeDisabled();

    const detail = await staff.call<ClientDetailDto>('GET', `/staff/clients/${client.id}`);
    expect(detail.client.rehabFollowupEnabled).toBe(true);

    // El cliente derivado ya puede reservar su seguimiento (D6).
    await login(page, client);
    await ui.visit('/reservar/fisioterapia');
    await expect(page.getByRole('heading', { level: 1, name: 'Seguimiento.' })).toBeVisible();
    const main = page.getByRole('main');
    await pickDayAndTime(main, slot.date, slot.time);
    await ui.expectFits();
    await main.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByText('Reserva confirmada', { exact: true })).toBeVisible();
    await ui.visit('/perfil');
    await expect(page.getByText(new RegExp(`— ${slot.time}$`))).toBeVisible();
  });

  test('configuración: planes, horarios, profesionales y reglas', async ({ page, ui, staff, isMobile }) => {
    const tag = uniquePerson().email.split('.')[1].split('@')[0];
    const tabs = page.getByRole('navigation', { name: 'Secciones de configuración' });

    await ui.visit('/staff/configuracion?tab=planes');
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
    const planRow = rowOf(page, `Plan E2E ${tag}`);
    await expect(planRow).toContainText('Inactivo');
    await planRow.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('dialog', { name: 'Eliminar plan' }).getByRole('button', { name: 'Eliminar' }).click();
    await expect(page.getByText('Plan eliminado.')).toBeVisible();
    await expect(planRow).toHaveCount(0);

    // Horarios: un horario semanal (creado, desactivado y borrado, y sus turnos generados cancelados) y un turno puntual.
    // Horas propias de cada proyecto, así desktop y mobile no comparten filas ni turnos.
    await tabs.getByRole('link', { name: 'Horarios' }).click();
    await expect(page).toHaveURL(/tab=horarios/);
    await expect(page.getByRole('button', { name: 'Nuevo horario' })).toBeVisible();
    await ui.expectFits();
    const templateTime = isMobile ? '04:43' : '04:17';
    const templateDialog = page.getByRole('dialog', { name: 'Nuevo horario' });
    await ui.clickUntil(page.getByRole('button', { name: 'Nuevo horario' }), templateDialog);
    await templateDialog.getByLabel('Servicio').selectOption('performance');
    await templateDialog.getByLabel('Día').selectOption('7');
    await templateDialog.getByLabel('Hora').fill(templateTime);
    await ui.expectFits();
    await templateDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Horario creado.')).toBeVisible();
    const templateRow = rowOf(page, templateTime);
    await expect(templateRow).toContainText('Dom');
    await expect(templateRow).toContainText('Activo');
    await templateRow.getByRole('button', { name: 'Desactivar' }).click();
    await expect(templateRow).toContainText('Inactivo');
    const templates = await staff.call<ScheduleTemplateDto[]>('GET', '/staff/schedule/templates?service=performance');
    const template = templates.find((item) => item.weekday === 7 && item.startTime.startsWith(templateTime));
    expect(template?.active).toBe(false);
    await staff.call('DELETE', `/staff/schedule/templates/${template?.id}`);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Nuevo horario' })).toBeVisible();
    await expect(templateRow).toHaveCount(0);
    // Borrar el horario no borra los turnos que ya generó para la ventana de reserva: se cancelan.
    const generated = await sundaySlotsAt(staff, templateTime);
    expect(generated.length).toBeGreaterThan(0);
    for (const slot of generated) await staff.call('POST', `/staff/time-slots/${slot.id}/cancel`);
    expect((await sundaySlotsAt(staff, templateTime)).filter((slot) => slot.cancelledAt === null)).toEqual([]);

    const slotDialog = page.getByRole('dialog', { name: 'Turno puntual' });
    await ui.clickUntil(page.getByRole('button', { name: 'Turno puntual' }), slotDialog);
    const date = businessDate(new Date(Date.now() + 3 * 86_400_000));
    const time = isMobile ? '05:37' : '05:13';
    await slotDialog.getByLabel('Servicio').selectOption('performance');
    await slotDialog.getByLabel('Fecha').fill(date);
    await slotDialog.getByLabel('Hora').fill(time);
    await slotDialog.getByLabel('Cupo').fill('6');
    await slotDialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Turno creado.')).toBeVisible();
    const slots = await staff.call<StaffTimeSlotDto[]>('GET', `/staff/time-slots?date=${date}&service=performance`);
    const created = slots.find((slot) => businessTime(new Date(slot.startsAt)) === time);
    expect(created?.capacity).toBe(6);

    await tabs.getByRole('link', { name: 'Profesionales' }).click();
    await expect(page).toHaveURL(/tab=profesionales/);
    const professional = `Profesional ${tag}`;
    await expect(page.getByLabel('Nombre del profesional')).toBeVisible();
    await ui.expectFits();
    await page.getByLabel('Nombre del profesional').fill(professional);
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByText('Profesional agregado.')).toBeVisible();
    const professionalRow = rowOf(page, professional);
    await expect(professionalRow).toContainText('Activo');
    await professionalRow.getByRole('button', { name: 'Desactivar' }).click();
    await expect(professionalRow).toContainText('Inactivo');
    await ui.expectFits();

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

  test('configuración: cada pestaña entra en pantalla', async ({ page, ui }) => {
    const tabs = page.getByRole('navigation', { name: 'Secciones de configuración' });
    const sections = [
      { tab: 'planes', label: 'Planes', content: page.getByRole('button', { name: 'Nuevo plan' }) },
      { tab: 'horarios', label: 'Horarios', content: page.getByRole('button', { name: 'Nuevo horario' }) },
      { tab: 'profesionales', label: 'Profesionales', content: page.getByLabel('Nombre del profesional') },
      { tab: 'reglas', label: 'Reglas', content: page.getByText('Valores provisorios — confirmar con MOVE') },
      { tab: 'contacto', label: 'Contacto', content: page.getByLabel('Email para avisos del staff') },
      { tab: 'calendario', label: 'Calendario', content: page.getByText('Falta configurar Google en el servidor', { exact: false }) },
    ];
    for (const section of sections) {
      await ui.visit(`/staff/configuracion?tab=${section.tab}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Configuración' })).toBeVisible();
      await expect(tabs.getByRole('link')).toHaveCount(sections.length);
      await expect(tabs.getByRole('link', { name: section.label, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(section.content).toBeVisible();
      await ui.expectFits();
    }
  });
});
