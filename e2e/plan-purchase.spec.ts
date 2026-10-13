// Flujo 3: compra de un plan Performance con el simulador de pagos. Aprobado → plan vigente en /perfil; rechazado →
// la compra de un plan queda en proceso (D44) y la página ofrece reintentar (D46). El "Pago no completado" de una
// reserva rechazada está en rehab-recovery.spec.ts.
import { expect, test } from './fixtures';
import { approvedTitle, payPlan } from './support/booking';

test.describe('Compra de plan Performance', () => {
  test('pago aprobado deja el plan vigente en el perfil', async ({ page, ui, createClient, login }) => {
    const client = await createClient();
    await login(page, client);

    await ui.visit('/planes?service=performance');
    await page.locator('a[href="/checkout/plan/performance-mensual"]').click();
    await expect(page).toHaveURL('/checkout/plan/performance-mensual');
    await expect(page.getByText('Plan Mensual', { exact: true }).first()).toBeVisible();
    await ui.expectFits();
    await payPlan(ui);

    await expect(approvedTitle(page)).toBeVisible();
    await expect(page.getByText('$ 3.900')).toBeVisible();
    await ui.expectFits();
    await page.getByRole('link', { name: 'Ir a mi perfil' }).click();
    await page.waitForURL('/perfil');
    await expect(page.getByRole('heading', { name: 'Plan Mensual — Performance' })).toBeVisible();
    await ui.expectFits();
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'Progreso del período' })).toBeVisible();
  });

  test('pago rechazado queda en proceso y se puede reintentar', async ({ page, ui, createClient, login }) => {
    // La página de resultado consulta 20 veces cada 3 s antes de mostrar "Pago en proceso".
    test.setTimeout(180_000);
    const client = await createClient();
    await login(page, client);

    await ui.visit('/checkout/plan/performance-mensual');
    await payPlan(ui, 'Rechazar');
    await expect(page.getByText('Confirmando tu pago')).toBeVisible();
    await expect(page.getByText('Pago en proceso')).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('Si tu pago fue rechazado, podés intentarlo de nuevo.')).toBeVisible();
    await ui.expectFits();

    const retry = page.getByRole('link', { name: 'Intentar de nuevo' });
    await expect(retry).toHaveAttribute('href', '/checkout/plan/performance-mensual');
    await retry.click();
    await expect(page).toHaveURL('/checkout/plan/performance-mensual');
    await payPlan(ui);
    await expect(approvedTitle(page)).toBeVisible();

    await ui.visit('/perfil');
    await expect(page.getByRole('heading', { name: 'Plan Mensual — Performance' })).toBeVisible();
  });
});
