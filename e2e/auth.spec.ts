// Flujo 2: registro e ingreso, logout y guards (cliente fuera de /staff; anónimo vuelve a la página exacta, D39), y
// recuperar / restablecer la contraseña.
import { clientPassword, expect, staffCredentials, test, uniquePerson } from './fixtures';

test.describe('Cuenta', () => {
  test('se registra, sale e ingresa de nuevo', async ({ page, ui, isMobile }) => {
    const person = uniquePerson('Lucía');
    const password = clientPassword();

    await ui.visit('/registro');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Ingresá tu nombre (mínimo 2 caracteres).')).toBeVisible();
    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
    await ui.expectFits();

    await page.getByLabel('Nombre y apellido').fill(person.name);
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Teléfono (opcional)').fill('099 123 456');
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await page.waitForURL('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: `Hola, ${person.firstName}.` })).toBeVisible();
    await ui.expectFits();

    await ui.logout('client');
    await ui.expectFits();
    const account = isMobile ? await ui.menu('public') : page.getByRole('banner');
    await expect(account.getByRole('link', { name: 'Ingresar' })).toBeVisible();

    await ui.visit('/ingresar');
    await page.getByLabel('Email').fill(person.email);
    await page.getByLabel('Contraseña').fill('incorrecta-123');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Email o contraseña incorrectos.' })).toBeVisible();
    await ui.expectFits();

    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: `Hola, ${person.firstName}.` })).toBeVisible();
  });

  test('un email ya registrado no crea otra cuenta', async ({ page, ui, createClient }) => {
    const client = await createClient();
    await ui.visit('/registro');
    await page.getByLabel('Nombre y apellido').fill('Otra Persona');
    await page.getByLabel('Email').fill(client.email);
    await page.getByLabel('Contraseña').fill(client.password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Ya existe una cuenta con ese email.' })).toBeVisible();
    await expect(page).toHaveURL(/\/registro/);
    await ui.expectFits();
  });

  test('un anónimo vuelve a la página exacta después de ingresar', async ({ page, ui, createClient }) => {
    const client = await createClient();
    await page.goto('/checkout/plan/performance-trimestral');
    await expect(page).toHaveURL('/ingresar?next=%2Fcheckout%2Fplan%2Fperformance-trimestral');
    await ui.expectFits();

    await page.getByLabel('Email').fill(client.email);
    await page.getByLabel('Contraseña').fill(client.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL('/checkout/plan/performance-trimestral');
    await expect(page.getByRole('heading', { level: 1, name: 'Confirmá tu plan.' })).toBeVisible();
    await expect(page.getByText('Plan Trimestral', { exact: true }).first()).toBeVisible();
    await ui.expectFits();
  });

  test('un cliente no entra al panel de staff', async ({ page, ui, createClient, login }) => {
    const client = await createClient();
    await login(page, client);
    await page.goto('/staff/clientes');
    await page.waitForURL('/perfil');
    await expect(page.getByRole('heading', { level: 1, name: `Hola, ${client.firstName}.` })).toBeVisible();
    await ui.expectFits();
    await ui.navigate('Historial', 'client');
    await expect(page.getByRole('heading', { level: 1, name: 'Historial.' })).toBeVisible();
    await ui.expectFits();
  });

  test('el staff ingresa al panel y no entra al área de clientes', async ({ page, ui }) => {
    const staff = staffCredentials();
    await ui.visit('/ingresar');
    await page.getByLabel('Email').fill(staff.email);
    await page.getByLabel('Contraseña').fill(staff.password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL('/staff');
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await ui.expectFits();

    await page.goto('/perfil');
    await page.waitForURL('/staff');
    await ui.logout('staff');
    await page.goto('/staff');
    await expect(page).toHaveURL('/ingresar?next=%2Fstaff');
    await ui.expectFits();
  });

  test('pide el link para recuperar la contraseña y rechaza un link inválido', async ({ page, ui, createClient }) => {
    const client = await createClient();

    await ui.visit('/ingresar');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await page.waitForURL('/recuperar');
    await expect(page.getByRole('heading', { level: 1, name: 'Recuperá tu acceso.' })).toBeVisible();
    await ui.expectFits();
    // Por rol: el formulario de /ingresar queda oculto en el DOM después de navegar y getByLabel lo encontraría.
    await page.getByRole('textbox', { name: 'Email' }).fill(client.email);
    await page.getByRole('button', { name: 'Enviar link' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Si el email está registrado, te enviamos un link para restablecer tu contraseña.' }),
    ).toBeVisible();
    await ui.expectFits();

    await ui.visit('/restablecer');
    await expect(page.getByRole('alert').filter({ hasText: 'El link para restablecer tu contraseña no es válido.' })).toBeVisible();

    await ui.visit('/restablecer?token=token-invalido-e2e');
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva contraseña.' })).toBeVisible();
    await page.getByLabel('Nueva contraseña').fill('una-clave-nueva-123');
    await page.getByLabel('Repetí la contraseña').fill('una-clave-nueva-123');
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'El link venció o ya fue usado.' })).toBeVisible();
    await ui.expectFits();
  });
});
