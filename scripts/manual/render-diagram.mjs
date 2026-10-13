// Renderiza el diagrama de arquitectura del manual: docs/manual/arquitectura.html → docs/manual/img/arquitectura.png.
// Correr antes de `pnpm manual:pdf` cuando cambie el HTML del diagrama.
//
// Requisito: Chromium de Playwright instalado (`pnpm exec playwright install chromium`).
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const MANUAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/manual');
const SOURCE = resolve(MANUAL_DIR, 'arquitectura.html');
const OUTPUT = resolve(MANUAL_DIR, 'img/arquitectura.png');

async function main() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(SOURCE).href, { waitUntil: 'load' });
    await page.locator('#diagram').screenshot({ path: OUTPUT });
  } finally {
    await browser.close();
  }
  console.log(`• ${OUTPUT}`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
