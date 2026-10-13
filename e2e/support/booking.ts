// Pasos de reserva y pago compartidos por las specs.
import { expect, type Locator, type Page } from '@playwright/test';
import { weeksAhead } from './time';

// Grilla de Performance: elige el día en el selector nativo y devuelve la tarjeta del turno de esa hora.
export async function performanceSlotCard(page: Page, date: string, time: string): Promise<Locator> {
  const schedule = page.locator('#horarios');
  const card = schedule.getByText(time, { exact: true }).locator('xpath=../..');
  await expect(async () => {
    await schedule.getByRole('combobox', { name: 'Día' }).selectOption(date);
    await expect(card).toBeVisible({ timeout: 3_000 });
  }).toPass();
  return card;
}

// Selector semanal + lista de horarios (Rehab, Recovery y Fisioterapia), dentro de `scope`.
export async function pickDayAndTime(scope: Locator, date: string, time: string): Promise<void> {
  const day = scope.getByRole('button', { name: String(Number(date.slice(8))), exact: true });
  const nextWeek = scope.getByRole('button', { name: 'Semana siguiente' });
  await expect(async () => {
    for (let week = 0; week < weeksAhead(date) && !(await day.isVisible()); week += 1) await nextWeek.click();
    await day.click({ timeout: 3_000 });
    await expect(day).toHaveAttribute('aria-pressed', 'true', { timeout: 2_000 });
  }).toPass();
  const slot = scope.getByRole('button', { name: time, exact: true });
  await slot.click();
  await expect(slot).toHaveAttribute('aria-pressed', 'true');
}

// Simulador de pagos (desarrollo): aprueba o rechaza y espera la página de resultado.
export async function settlePayment(page: Page, outcome: 'Aprobar' | 'Rechazar'): Promise<void> {
  await page.waitForURL(/\/checkout\/simulado\?ref=/);
  await expect(page.getByText('Simulador de pagos (desarrollo)')).toBeVisible();
  await page.getByRole('button', { name: outcome }).click();
  await page.waitForURL(/\/checkout\/resultado\?ref=/);
}

// Checkout de un plan o paquete: paga con el simulador y aprueba.
export async function payPlan(page: Page, outcome: 'Aprobar' | 'Rechazar' = 'Aprobar'): Promise<void> {
  await expect(page.getByRole('heading', { level: 1, name: 'Confirmá tu plan.' })).toBeVisible();
  await page.getByRole('button', { name: 'Pagar con Mercado Pago' }).click();
  await settlePayment(page, outcome);
}

export const approvedTitle = (page: Page) => page.getByText('¡Listo! Tu pago fue aprobado.');
