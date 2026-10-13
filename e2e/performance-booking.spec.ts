// Flujo 4: reservas de Performance. Reserva, límite de cupo, cancelación dentro y fuera del plazo, y plan vencido.
import type { BookingDto } from '../apps/web/src/lib/api/types';
import { expect, test } from './fixtures';
import { expireSubscription } from './support/sql';
import { performanceSlotCard } from './support/booking';
import { addDays, businessDate, businessTime, displayDate } from './support/time';

test.describe('Reservas Performance', () => {
  test('reserva un turno con plan vigente', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient({ plan: 'performance-mensual' });
    const slot = await createSlot({ service: 'performance', capacity: 3 });
    await login(page, client);

    await ui.visit('/reservar');
    await page.getByRole('main').getByRole('link', { name: /^Performance/ }).click();
    await expect(page).toHaveURL('/performance#horarios');
    const card = await performanceSlotCard(page, slot.date, slot.time);
    await expect(card).toContainText('0 / 3 cupos');
    await card.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByText('Reserva confirmada', { exact: true })).toBeVisible();
    await expect(card).toContainText('Reservado');
    await expect(card).toContainText('1 / 3 cupos');
    await ui.expectFits();

    await ui.visit('/perfil');
    await expect(page.getByText(`Performance — ${slot.time}`)).toBeVisible();
  });

  test('respeta el límite de cupo', async ({ page, ui, createClient, createSlot, login }) => {
    const [client, other, another] = await Promise.all([
      createClient({ plan: 'performance-mensual' }),
      createClient({ plan: 'performance-mensual' }),
      createClient({ plan: 'performance-mensual' }),
    ]);
    const full = await createSlot({ service: 'performance', capacity: 1 });
    await other.api.call('POST', '/bookings', { timeSlotId: full.id });
    await login(page, client);

    await ui.visit('/performance');
    const fullCard = await performanceSlotCard(page, full.date, full.time);
    await expect(fullCard).toContainText('Completo');
    await expect(fullCard).toContainText('1 / 1 cupos');
    await expect(fullCard.getByRole('button', { name: 'Reservar' })).toHaveCount(0);

    // Otro cliente toma el último lugar mientras la página está abierta: la API responde SLOT_FULL.
    const last = await createSlot({ service: 'performance', capacity: 1 });
    await page.reload();
    const lastCard = await performanceSlotCard(page, last.date, last.time);
    await expect(lastCard.getByRole('button', { name: 'Reservar' })).toBeVisible();
    await another.api.call('POST', '/bookings', { timeSlotId: last.id });
    await lastCard.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByText('El turno está completo.')).toBeVisible();
    await expect(lastCard).toContainText('Completo');
  });

  test('cancela dentro del plazo y no puede fuera del plazo', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient({ plan: 'performance-mensual' });
    const later = await createSlot({ service: 'performance', capacity: 2 });
    // Turno que empieza en 75 minutos: dentro del límite de cancelación (2 h).
    const soonStart = new Date(Date.now() + 75 * 60_000);
    const soon = await createSlot({ service: 'performance', capacity: 2, date: businessDate(soonStart), time: businessTime(soonStart) });
    await client.api.call('POST', '/bookings', { timeSlotId: later.id });
    const soonBooking = await client.api.call<BookingDto>('POST', '/bookings', { timeSlotId: soon.id });
    await login(page, client);

    await ui.visit('/perfil');
    await expect(page.getByText(`Performance — ${soon.time}`).first()).toBeVisible();
    await expect(page.getByRole('button', { name: `Cancelar reserva del ${displayDate(soon.date)} a las ${soon.time}` })).toHaveCount(0);
    // La regla también la aplica la API, no solo la pantalla.
    await expect(client.api.call('POST', `/bookings/${soonBooking.id}/cancel`)).rejects.toThrow('409 CANCEL_WINDOW_CLOSED');

    await page.getByRole('button', { name: `Cancelar reserva del ${displayDate(later.date)} a las ${later.time}` }).click();
    const dialog = page.getByRole('dialog', { name: `¿Cancelar la reserva del ${displayDate(later.date)} a las ${later.time}?` });
    await expect(dialog).toBeVisible();
    await ui.expectFits();
    await dialog.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText('Reserva cancelada', { exact: true })).toBeVisible();
    await expect(page.getByText(`Performance — ${later.time}`)).toHaveCount(0);
  });

  test('un plan vencido bloquea nuevas reservas', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient({ plan: 'performance-mensual' });
    expireSubscription(client.id, addDays(businessDate(), -1));
    const slot = await createSlot({ service: 'performance', capacity: 3 });
    await login(page, client);

    await ui.visit('/perfil');
    await expect(page.getByText('Vencido', { exact: true })).toBeVisible();

    await ui.visit('/performance');
    const card = await performanceSlotCard(page, slot.date, slot.time);
    await card.getByRole('button', { name: 'Reservar' }).click();
    const notice = page.getByRole('alert').filter({ hasText: 'Tu plan no está vigente para esa fecha.' });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole('link', { name: 'Renovar plan' })).toHaveAttribute('href', '/planes?service=performance');
    await expect(card).toContainText('0 / 3 cupos');
  });
});

