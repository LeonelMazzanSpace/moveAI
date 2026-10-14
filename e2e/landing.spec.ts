// Flujo 8: contenido fijo de la landing (D90, D92). Equipo en el inicio, Recovery Room en /recovery y la regla
// "Plan vigente" de /performance.
import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures';

const TEAM = [
  { name: 'Pierina Paladini', specialty: 'Ecografía músculo-esquelética' },
  { name: 'Gianluca Pasini', specialty: 'Fuerza y potencia' },
  { name: 'Leandro Olenchuk', specialty: 'Entrenamiento en sala' },
];

const RECOVERY_EQUIPMENT = [
  'Botas de presoterapia',
  'Luz roja e infrarroja',
  'Sauna infrarrojo',
  'Meditación y respiración',
  'Sillón de gravedad cero',
];

// Cada foto se pide con loading perezoso: se la acerca a la vista y se espera a que el navegador la decodifique.
async function expectLoaded(image: Locator): Promise<void> {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth)).toBeGreaterThan(0);
}

test.describe('Landing', () => {
  test('el inicio muestra el equipo con sus fotos y el menú lleva a #equipo', async ({ page, ui, isMobile }) => {
    await ui.visit('/');
    const team = page.locator('#equipo');
    await expect(team.getByRole('heading', { name: 'El equipo detrás de MOVE' })).toBeVisible();
    for (const member of TEAM) {
      const card = team.getByRole('article').filter({ has: page.getByRole('heading', { name: member.name }) });
      await expect(card).toHaveCount(1);
      await expect(card.getByText(member.specialty, { exact: true })).toBeVisible();
      await expectLoaded(card.getByRole('img', { name: new RegExp(`^${member.name}`) }));
    }
    await ui.expectFits();

    await page.evaluate(() => window.scrollTo(0, 0));
    await ui.navigate('Equipo');
    await expect(page).toHaveURL(/\/#equipo$/);
    await expect(team.getByRole('heading', { name: 'El equipo detrás de MOVE' })).toBeInViewport();
    if (isMobile) await expect(page.getByRole('dialog', { name: 'Menú' })).toBeHidden();
    await ui.expectFits();
  });

  test('Recovery muestra el Recovery Room con sus 5 equipos y 3 fotos', async ({ page, ui }) => {
    await ui.visit('/recovery');
    const room = page.locator('#recovery-room');
    await expect(room.getByRole('heading', { level: 2, name: /Recovery Room/ })).toBeVisible();
    const equipment = room.getByRole('listitem');
    await expect(equipment).toHaveCount(RECOVERY_EQUIPMENT.length);
    for (const title of RECOVERY_EQUIPMENT) await expect(equipment.filter({ has: page.getByRole('heading', { name: title }) })).toHaveCount(1);

    const photos = room.getByRole('img');
    await expect(photos).toHaveCount(3);
    await expectLoaded(photos.nth(0));
    await expectLoaded(photos.nth(1));
    await expectLoaded(photos.nth(2));
    await expect(photos.nth(0)).toHaveAttribute('alt', /Sillón de gravedad cero/);
    await ui.expectFits();
  });

  test('Performance explica la regla con "Plan vigente" y no con "Plan vencido"', async ({ page, ui }) => {
    await ui.visit('/performance');
    const rule = page.getByText('Plan vigente:', { exact: true });
    await expect(rule).toBeVisible();
    await expect(rule.locator('xpath=..')).toContainText('para reservar necesitás un plan activo en la fecha del turno');
    await expect(page.getByText('Plan vencido:')).toHaveCount(0);
  });
});
