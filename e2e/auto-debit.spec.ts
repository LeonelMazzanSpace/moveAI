// Flujo 10: débito automático de Mercado Pago (D96, D97) con el simulador. El cliente contrata Performance mensual con
// débito y lo autoriza, lo ve en el perfil, no puede comprar un pago único de Performance mientras esté activo y lo
// cancela; el staff ve el badge en Pagos.
import { expect, rowOf, staffCredentials, test } from './fixtures';
import { authorizeAutoDebit } from './support/booking';

const ACTIVE_DEBIT = /^Débito automático activo · próximo cobro \d{2}\/\d{2}$/;

test.describe('Débito automático', () => {
  test('contrata, bloquea el pago único de Performance, se cancela y el staff ve el badge', async ({ page, ui, createClient, login }) => {
    const client = await createClient();
    await login(page, client);

    await authorizeAutoDebit(ui, 'performance-mensual');
    await expect(page.getByText('Plan Mensual', { exact: true })).toBeVisible();
    await expect(page.getByText('Próximo cobro', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Ir a mi perfil' }).click();
    await page.waitForURL('/perfil');

    await expect(page.getByRole('heading', { name: 'Plan Mensual — Performance' })).toBeVisible();
    await expect(page.getByText(ACTIVE_DEBIT)).toBeVisible();
    await ui.expectFits();

    // D97: con un débito autorizado de Performance no se compra un pago único del mismo servicio.
    await ui.visit('/checkout/plan/performance-mensual');
    await expect(page.getByRole('status').filter({ hasText: 'Ya tenés débito automático activo para Performance.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gestionarlo en mi perfil' })).toHaveAttribute('href', '/perfil');
    await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Activar débito automático' })).toHaveCount(0);

    await ui.visit('/perfil');
    const cancel = page.getByRole('button', { name: 'Cancelar débito' });
    const dialog = page.getByRole('dialog', { name: '¿Cancelar el débito automático?' });
    await ui.clickUntil(cancel, dialog);
    await expect(dialog).toContainText('Lo que ya pagaste sigue vigente hasta el');
    await ui.expectFits();
    await dialog.getByRole('button', { name: 'Sí, cancelar débito' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(ACTIVE_DEBIT)).toHaveCount(0);
    await expect(cancel).toHaveCount(0);
    // Lo ya pagado sigue vigente.
    await expect(page.getByRole('heading', { name: 'Plan Mensual — Performance' })).toBeVisible();

    // Cancelado, el cliente puede volver a contratar o pagar una sola vez.
    await ui.visit('/checkout/plan/performance-mensual');
    await expect(page.getByRole('button', { name: 'Pagar con Mercado Pago' })).toBeVisible();

    await login(page, staffCredentials());
    await ui.visit('/staff/pagos?origen=debito');
    const payment = rowOf(page, client.name);
    await expect(payment).toHaveCount(1);
    await expect(payment).toContainText('Plan Mensual');
    await expect(payment).toContainText('$ 3.900');
    await expect(payment.getByText('Débito automático', { exact: true })).toBeVisible();
    await ui.expectFits();
  });
});
