// Pruebas end to end de la web (D73): los mismos flujos en desktop (Chromium 1440×900) y mobile (iPhone 15 con
// Chromium). Antes de correrlas: `pnpm e2e:reset`. Ver docs/development.md, "Pruebas end to end".
import { defineConfig, devices } from '@playwright/test';
import { apiEnv, E2E_API_URL, E2E_WEB_PORT, E2E_WEB_URL, webEnv } from './scripts/e2e/env.mjs';

const BUILD_TIMEOUT_MS = 600_000;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Reporte y resultados dentro de artifacts/ (ignorado por git).
  outputDir: 'artifacts/e2e/results',
  reporter: [['list'], ['html', { outputFolder: 'artifacts/e2e/report', open: 'never' }]],
  use: {
    baseURL: E2E_WEB_URL,
    locale: 'es-UY',
    timezoneId: 'America/Montevideo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // No hay WebKit instalado: el iPhone 15 de Playwright con Chromium (viewport, touch y user agent móviles).
      name: 'mobile',
      use: { ...devices['iPhone 15'], browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @move/api build && node apps/api/dist/main.js',
      url: `${E2E_API_URL}/health`,
      env: apiEnv(),
      reuseExistingServer: false,
      timeout: BUILD_TIMEOUT_MS,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm --filter @move/web build && pnpm --filter @move/web start -p ${E2E_WEB_PORT}`,
      url: E2E_WEB_URL,
      env: webEnv(),
      reuseExistingServer: false,
      timeout: BUILD_TIMEOUT_MS,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
