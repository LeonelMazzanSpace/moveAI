// Flujo 5: Rehab (evaluación) y Recovery (sesión individual) como invitado y con cuenta, paquete Recovery y tope de
// reservas pendientes de pago (HOLD_LIMIT_REACHED, D53).
import type { Page } from '@playwright/test';
import type { PlanDto } from '../apps/web/src/lib/api/types';
import { expect, test, uniquePerson } from './fixtures';
import { approvedTitle, payPlan, pickDayAndTime, settlePayment } from './support/booking';

async function fillGuest(page: Page, guest: { name: string; email: string }): Promise<void> {
  await page.getByLabel('Nombre').fill(guest.name);
  await page.getByLabel('Email').fill(guest.email);
  await page.getByLabel('Teléfono').fill('099 765 432');
}

test.describe('Rehab', () => {
  test('un invitado reserva y paga la evaluación', async ({ page, ui, createSlot }) => {
    const slot = await createSlot({ service: 'rehab' });
    const guest = uniquePerson('Paula');

    await ui.visit('/rehab#reservar');
    const flow = page.locator('#reservar');
    await expect(flow.getByRole('heading', { name: 'Reservá tu evaluación.' })).toBeVisible();
    await pickDayAndTime(flow, slot.date, slot.time);
    await expect(flow.getByText('$ 1.800').first()).toBeVisible();
    await flow.getByRole('button', { name: 'Continuar al pago' }).click();
    await flow.getByRole('button', { name: 'Ir a pagar' }).click();
    await expect(flow.getByText('Ingresá un email válido.')).toBeVisible();
    await fillGuest(page, guest);
    await ui.expectFits();
    await flow.getByRole('button', { name: 'Ir a pagar' }).click();
    await settlePayment(ui, 'Aprobar');

    await expect(approvedTitle(page)).toBeVisible();
    await expect(page.getByText('Evaluación y Diagnóstico').first()).toBeVisible();
    await expect(page.getByText(new RegExp(`· ${slot.time}$`))).toBeVisible();
    await ui.expectFits();
  });

  test('un invitado con un email que ya tiene cuenta tiene que ingresar', async ({ page, ui, createClient, createSlot }) => {
    const client = await createClient();
    const slot = await createSlot({ service: 'rehab' });

    await ui.visit('/rehab');
    const flow = page.locator('#reservar');
    await pickDayAndTime(flow, slot.date, slot.time);
    await flow.getByRole('button', { name: 'Continuar al pago' }).click();
    await fillGuest(page, { name: client.name, email: client.email });
    await flow.getByRole('button', { name: 'Ir a pagar' }).click();
    const error = flow.getByRole('alert').filter({ hasText: 'Ya tenés una cuenta con ese email: ingresá para continuar.' });
    await expect(error).toBeVisible();
    await expect(error.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar?next=%2Frehab');
    await ui.expectFits();
  });

  test('con cuenta: pago rechazado, reintento y aprobado', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient();
    const slot = await createSlot({ service: 'rehab' });
    await login(page, client);

    await ui.visit('/rehab');
    const flow = page.locator('#reservar');
    await pickDayAndTime(flow, slot.date, slot.time);
    await flow.getByRole('button', { name: 'Continuar al pago' }).click();
    await settlePayment(ui, 'Rechazar');
    await expect(page.getByText('Pago no completado')).toBeVisible();
    await expect(page.getByText('El pago no se completó.')).toBeVisible();
    await ui.expectFits();

    const retry = page.getByRole('link', { name: 'Intentar de nuevo' });
    await expect(retry).toHaveAttribute('href', '/rehab#reservar');
    await retry.click();
    await expect(page).toHaveURL('/rehab#reservar');
    await ui.expectFits();
    // El rechazo liberó el turno: se puede volver a elegir.
    await pickDayAndTime(page.locator('#reservar'), slot.date, slot.time);
    await page.locator('#reservar').getByRole('button', { name: 'Continuar al pago' }).click();
    await settlePayment(ui, 'Aprobar');
    await expect(approvedTitle(page)).toBeVisible();

    await ui.visit('/perfil');
    await expect(page.getByText(new RegExp(`— ${slot.time}$`))).toBeVisible();
    await expect(page.getByText('Cancelación con MOVE')).toBeVisible();
  });
});

test.describe('Recovery', () => {
  test('un invitado reserva y paga una sesión individual', async ({ page, ui, createSlot }) => {
    const slot = await createSlot({ service: 'recovery', capacity: 2, durationMinutes: 45 });
    const guest = uniquePerson('Mateo');

    await ui.visit('/recovery');
    const flow = page.locator('#reservar');
    await ui.clickUntil(flow.getByRole('button', { name: 'Sesión individual' }), flow.getByRole('button', { name: 'Continuar al pago' }));
    await pickDayAndTime(flow, slot.date, slot.time);
    await flow.getByRole('button', { name: 'Continuar al pago' }).click();
    await fillGuest(page, guest);
    await flow.getByRole('button', { name: 'Ir a pagar' }).click();
    await settlePayment(ui, 'Aprobar');

    await expect(approvedTitle(page)).toBeVisible();
    await expect(page.getByText('Sesión individual').first()).toBeVisible();
    await expect(page.getByText('$ 900')).toBeVisible();
  });

  test('con cuenta compra un paquete y reserva con el saldo', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient();
    const slot = await createSlot({ service: 'recovery', capacity: 2, durationMinutes: 45 });
    await login(page, client);

    await ui.visit('/recovery');
    const flow = page.locator('#reservar');
    const pack = flow.getByRole('link', { name: 'Contratar paquete' }).first();
    await ui.clickUntil(flow.getByRole('button', { name: 'Paquete' }), pack);
    await expect(flow.getByText('/paquete').first()).toBeVisible();
    await ui.expectFits();
    await flow.locator('a[href="/checkout/plan/recovery-paquete-4"]').click();
    await expect(page.getByText('Las sesiones no usadas vencen al final del período.')).toBeVisible();
    await payPlan(ui);
    await expect(approvedTitle(page)).toBeVisible();

    await ui.visit('/recovery');
    await expect(flow.getByText('Te quedan 4 sesiones')).toBeVisible();
    await pickDayAndTime(flow, slot.date, slot.time);
    await flow.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page.getByText('Reserva confirmada', { exact: true })).toBeVisible();
    await expect(flow.getByText('Te quedan 3 sesiones')).toBeVisible();

    await ui.visit('/perfil');
    await expect(page.getByRole('heading', { name: 'Paquetes Recovery' })).toBeVisible();
    await expect(page.getByText('Paquete 4 sesiones').first()).toBeVisible();
    await expect(page.getByText(`Recovery — ${slot.time}`)).toBeVisible();
  });

  test('no permite más de dos reservas pendientes de pago', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient();
    const plan = await client.api.call<PlanDto>('GET', '/catalog/plans/recovery-sesion');
    const [first, second, third] = await Promise.all([1, 2, 3].map(() => createSlot({ service: 'recovery', capacity: 2, durationMinutes: 45 })));
    for (const slot of [first, second]) {
      await client.api.call('POST', '/checkout/booking', { planId: plan.id, timeSlotId: slot.id });
    }
    await login(page, client);

    await ui.visit('/recovery');
    const flow = page.locator('#reservar');
    await ui.clickUntil(flow.getByRole('button', { name: 'Sesión individual' }), flow.getByRole('button', { name: 'Continuar al pago' }));
    await pickDayAndTime(flow, third.date, third.time);
    await flow.getByRole('button', { name: 'Continuar al pago' }).click();
    await expect(flow.getByRole('alert')).toHaveText(
      'Ya tenés reservas pendientes de pago. Completá el pago o esperá a que venzan.',
    );
    await expect(page).toHaveURL(/\/recovery/);
    await ui.expectFits();
  });
});
