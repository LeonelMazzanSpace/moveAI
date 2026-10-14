// Flujo 9: datos de contacto editables (D91). El footer público muestra la semilla con sus links y el staff cambia el
// horario en Configuración → Contacto.
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { StaffContactInfoDto } from '../apps/web/src/lib/api/types';
import { E2E_DB_NAME } from '../scripts/e2e/env.mjs';
import { expect, staffCredentials, test, uniquePerson } from './fixtures';

const SEED = {
  address: 'Máximo Tajes 6397 esquina Beranger',
  hours: 'Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00',
  whatsapp: '+598 99 140 299',
  instagram: '@move_strengthconditioning',
};

// Desktop y mobile corren esta prueba a la vez sobre los mismos datos de contacto: el que entra primero termina (y
// restaura el horario) antes de que entre el otro.
const LOCK_DIR = join(tmpdir(), `move-e2e-contact-${E2E_DB_NAME}.lock`);
const STALE_LOCK_MS = 180_000;

function tryLock(): boolean {
  try {
    mkdirSync(LOCK_DIR);
    return true;
  } catch {
    const taken = statSync(LOCK_DIR, { throwIfNoEntry: false });
    if (taken && Date.now() - taken.mtimeMs > STALE_LOCK_MS) rmSync(LOCK_DIR, { recursive: true, force: true });
    return false;
  }
}

test.describe('Contacto', () => {
  test('el footer muestra el contacto con sus links y refleja el horario que cambia el staff', async ({ page, ui, staff, login }) => {
    test.setTimeout(150_000);
    await expect.poll(tryLock, { timeout: 120_000, intervals: [250, 500, 1_000] }).toBe(true);
    try {
      const original = await staff.call<StaffContactInfoDto>('GET', '/staff/settings/contact');
      expect(original).toMatchObject(SEED);

      await ui.visit('/');
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByText(SEED.address, { exact: true })).toBeVisible();
      await expect(footer.getByText(SEED.hours, { exact: true })).toBeVisible();
      await expect(footer.getByRole('link', { name: SEED.whatsapp })).toHaveAttribute('href', 'https://wa.me/59899140299');
      await expect(footer.getByRole('link', { name: SEED.instagram })).toHaveAttribute('href', 'https://www.instagram.com/move_strengthconditioning/');
      await expect(footer.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('href', original.mapsUrl);
      expect(original.mapsUrl).toMatch(/^https:\/\/www\.google\.com\/maps\//);
      // Email vacío en la semilla: no se muestra.
      await expect(footer.getByText('Email', { exact: true })).toHaveCount(0);
      // "Dónde estamos" repite los mismos datos con sus CTAs.
      const where = page.locator('#contacto');
      await expect(where.getByRole('heading', { name: 'Dónde estamos' })).toBeVisible();
      await expect(where.getByRole('link', { name: 'Escribinos por WhatsApp' })).toHaveAttribute('href', 'https://wa.me/59899140299');
      await expect(where.getByRole('link', { name: 'Abrir en Google Maps' })).toHaveAttribute('href', original.mapsUrl);

      try {
        const hours = `Lunes a viernes · E2E ${uniquePerson().email.split('.')[1].split('@')[0]}`;
        await login(page, staffCredentials());
        await ui.visit('/staff/configuracion?tab=contacto');
        const field = page.getByLabel('Horarios', { exact: true });
        await expect(field).toHaveValue(SEED.hours);

        await field.fill('x'.repeat(201));
        await page.getByRole('button', { name: 'Guardar' }).click();
        await expect(page.getByText('Máximo 200 caracteres.')).toBeVisible();
        await ui.expectFits();

        await field.fill(hours);
        await page.getByLabel('WhatsApp', { exact: true }).fill('099 140 299');
        await page.getByRole('button', { name: 'Guardar' }).click();
        await expect(page.getByText('Empezá con + y el código de país', { exact: false })).toBeVisible();

        await page.getByLabel('WhatsApp', { exact: true }).fill(SEED.whatsapp);
        await page.getByRole('button', { name: 'Guardar' }).click();
        await expect(page.getByText('Contacto guardado.')).toBeVisible();

        await ui.visit('/');
        await expect(page.getByRole('contentinfo').getByText(hours, { exact: true })).toBeVisible();
        await expect(page.locator('#contacto').getByText(hours, { exact: true })).toBeVisible();
        await ui.visit('/performance');
        await expect(page.getByRole('contentinfo').getByText(hours, { exact: true })).toBeVisible();
      } finally {
        await staff.call('PATCH', '/staff/settings/contact', { hours: original.hours });
      }
    } finally {
      rmSync(LOCK_DIR, { recursive: true, force: true });
    }
  });
});
