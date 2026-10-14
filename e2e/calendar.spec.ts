// Flujo 11: pestaña Calendario de Configuración (D94). El entorno de E2E no tiene credenciales de Google ni
// CALENDAR_TOKEN_KEY: la pestaña muestra "no configurado" y no ofrece conectar.
import { expect, staffCredentials, test } from './fixtures';

test.describe('Calendario', () => {
  test('la pestaña Calendario muestra que Google no está configurado', async ({ page, ui, staff, login }) => {
    await login(page, staffCredentials());
    await ui.visit('/staff/configuracion?tab=planes');
    const tabs = page.getByRole('navigation', { name: 'Secciones de configuración' });
    await tabs.getByRole('link', { name: 'Calendario' }).click();
    await expect(page).toHaveURL(/tab=calendario/);
    await expect(tabs.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page');

    await expect(page.getByText('Falta configurar Google en el servidor', { exact: false })).toBeVisible();
    await expect(page.getByText('GOOGLE_CLIENT_ID', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conectar Google Calendar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sincronizar ahora' })).toHaveCount(0);
    await ui.expectFits();

    // La API coincide: sin configuración no hay conexión posible.
    const status = await staff.call<{ configured: boolean; status: string }>('GET', '/staff/calendar');
    expect(status).toMatchObject({ configured: false, status: 'disconnected' });
  });
});
