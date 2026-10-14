// Flujo 1: visitante. Inicio, Performance, Rehab, Recovery y Planes navegando con el header (desktop) o con el menú
// móvil (mobile).
import { expect, test } from './fixtures';

test.describe('Visitante', () => {
  test('recorre el sitio público con la navegación principal', async ({ page, ui, isMobile }) => {
    await ui.visit('/');
    await expect(page.getByRole('heading', { level: 1, name: /Movete mejor/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tres áreas. Una experiencia.' })).toBeVisible();
    if (isMobile) {
      await expect(page.getByRole('banner').getByRole('navigation')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeHidden();
    }

    const pages = [
      { label: 'Performance', path: '/performance', heading: /Entrenamiento/ },
      { label: 'Rehab', path: '/rehab', heading: /Evaluación y/ },
      { label: 'Recovery', path: '/recovery', heading: /Recuperá/ },
      { label: 'Planes', path: '/planes', heading: 'Elegí tu plan.' },
      { label: 'Inicio', path: '/', heading: /Movete mejor/ },
    ];
    for (const target of pages) {
      await ui.navigate(target.label);
      await expect(page).toHaveURL(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
      await ui.expectFits();
    }
  });

  test('ve los planes de Performance y los paquetes Recovery con su precio', async ({ page, ui }) => {
    await ui.visit('/planes');
    const filters = page.getByRole('navigation', { name: 'Filtrar planes' });
    await expect(page.getByRole('heading', { name: 'Performance.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recovery.' })).toBeVisible();
    await expect(page.getByText('Plan Mensual', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contratar', exact: true }).first()).toHaveAttribute('href', /\/checkout\/plan\/performance-/);

    await filters.getByRole('link', { name: 'Recovery' }).click();
    await expect(page).toHaveURL('/planes?service=recovery');
    await expect(page.getByRole('heading', { name: 'Performance.' })).toBeHidden();
    await expect(page.getByText('Paquete 4 sesiones', { exact: true })).toBeVisible();
    // D71: los paquetes Recovery se cobran por paquete.
    await expect(page.getByText('/paquete').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contratar paquete' }).first()).toHaveAttribute('href', /\/checkout\/plan\/recovery-paquete-/);
    await ui.expectFits();

    await ui.visit('/reservar');
    await expect(page.getByRole('heading', { level: 1, name: '¿Qué querés reservar?' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: /^Rehab/ })).toHaveAttribute('href', '/rehab#reservar');
  });
});

test.describe('Pantallas de acceso y checkout sin sesión', () => {
  test('recuperar, continuar, resultado y simulador sin parámetros entran en pantalla', async ({ page, ui }) => {
    await ui.visit('/recuperar');
    await expect(page.getByRole('heading', { level: 1, name: 'Recuperá tu acceso.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a ingresar' })).toHaveAttribute('href', '/ingresar');

    // Sin sesión, /continuar no redirige: ofrece ingresar.
    await ui.visit('/continuar');
    await expect(page.getByText('Tu sesión no está activa.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ingresar' })).toHaveAttribute('href', '/ingresar');
    await ui.expectFits();

    await ui.visit('/checkout/resultado');
    await expect(page.getByRole('heading', { level: 1, name: 'Tu pago.' })).toBeVisible();
    await expect(page.getByText('No encontramos la operación')).toBeVisible();
    await ui.expectFits();

    await ui.visit('/checkout/simulado');
    await expect(page.getByText('No encontramos la operación')).toBeVisible();
    await expect(page.getByText('Falta la referencia del pago.')).toBeVisible();
    await ui.expectFits();
  });
});
