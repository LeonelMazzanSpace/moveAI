// Flujo 6: perfil, historial y check-in mensual (una respuesta con molestia genera una alerta para el staff).
import type { AlertDto } from '../apps/web/src/lib/api/types';
import { buyPlan, expect, test } from './fixtures';

test.describe('Área de clientes', () => {
  test('perfil e historial muestran plan, paquete, reservas y pagos', async ({ page, ui, createClient, createSlot, login }) => {
    const client = await createClient({ plan: 'performance-mensual' });
    await buyPlan(client.api, 'recovery-paquete-4');
    const slot = await createSlot({ service: 'performance', capacity: 3 });
    await client.api.call('POST', '/bookings', { timeSlotId: slot.id });
    await login(page, client);

    await ui.visit('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: `Hola, ${client.firstName}.` })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan Mensual — Performance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Paquetes Recovery' })).toBeVisible();
    await expect(page.getByText('Paquete 4 sesiones').first()).toBeVisible();
    await expect(page.getByText(`Performance — ${slot.time}`)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tu mes en MOVE' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();

    await ui.navigate('Historial', 'client');
    await expect(page).toHaveURL('/historial');
    await expect(page.getByRole('heading', { name: 'Historial de actividad' })).toBeVisible();
    const panel = page.getByRole('main').getByRole('list');
    await page.getByRole('tab', { name: 'Pagos' }).click();
    await expect(page.getByRole('tab', { name: 'Pagos' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByText('Pago — Plan Mensual · $ 3.900').first()).toBeVisible();
    await expect(panel.getByText('Pago — Paquete 4 sesiones · $ 3.200').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Reservas' }).click();
    await expect(page.getByRole('tab', { name: 'Reservas' })).toHaveAttribute('aria-selected', 'true');
    await expect(panel.getByText(/^Pago —/)).toHaveCount(0);
    await expect(panel.getByText(/Performance/).first()).toBeVisible();
    await ui.expectFits();
  });

  test('responde el check-in mensual con molestia y el staff recibe la alerta', async ({ page, ui, createClient, staff, login }) => {
    const client = await createClient({ plan: 'performance-mensual' });
    await staff.call('POST', '/staff/checkins/send');
    await login(page, client);

    await ui.visit('/perfil');
    await expect(page.getByText('Tenés un check-in pendiente')).toBeVisible();
    await page.getByRole('link', { name: 'Responder check-in' }).click();
    await page.waitForURL('/check-in');
    await expect(page.getByRole('heading', { name: `¿Cómo venís, ${client.firstName}?` })).toBeVisible();

    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(page.getByText('Elegí cómo te sentís.')).toBeVisible();

    await page.getByRole('group', { name: '¿Cómo te sentís con el entrenamiento?' }).getByText('Me cuesta').click();
    await page.getByRole('group', { name: '¿Sentiste alguna molestia o dolor?' }).getByText('Sí, leve').click();
    await page.getByRole('group', { name: '¿Cambiaron tus objetivos?' }).getByText('Siguen igual').click();
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(page.getByText('Contanos dónde sentís la molestia.')).toBeVisible();
    await page.getByLabel('¿Dónde?').fill('Rodilla derecha al hacer sentadillas');
    await ui.expectFits();
    await page.getByRole('button', { name: 'Enviar respuesta' }).click();
    await expect(page.getByRole('status').filter({ hasText: '¡Gracias! El equipo de MOVE revisa tus respuestas.' })).toBeVisible();

    const alerts = await staff.call<AlertDto[]>('GET', '/staff/alerts?type=checkin_pain');
    const alert = alerts.find((item) => item.client.id === client.id);
    expect(alert?.checkin?.painDetail).toBe('Rodilla derecha al hacer sentadillas');
  });
});
