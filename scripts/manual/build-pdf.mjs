// Genera docs/manual/manual-de-usuario.pdf a partir de docs/manual/manual-de-usuario.md:
// Markdown → HTML (marked) con las imágenes embebidas → PDF A4 (Chromium de Playwright).
//
// Requisito: Chromium de Playwright instalado (`pnpm exec playwright install chromium`).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';

const MANUAL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/manual');
const SOURCE = resolve(MANUAL_DIR, 'manual-de-usuario.md');
const OUTPUT = resolve(MANUAL_DIR, 'manual-de-usuario.pdf');

const STYLES = `
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; line-height: 1.5; color: #1a1a1a; background: #fff; margin: 0; }
  h1 { font-size: 24pt; margin: 0 0 6pt; line-height: 1.15; }
  h2 { font-size: 17pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #1a1a1a; break-after: avoid; }
  h3 { font-size: 13pt; margin: 16pt 0 6pt; break-after: avoid; }
  h4 { font-size: 11pt; margin: 12pt 0 4pt; break-after: avoid; }
  h2.part { break-before: page; font-size: 20pt; }
  p, ul, ol, table, blockquote { margin: 0 0 8pt; }
  ul, ol { padding-left: 18pt; }
  li { margin-bottom: 2pt; }
  a { color: #0b4fa8; text-decoration: none; }
  code { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 9pt; background: #f1f1f1; padding: 1pt 3pt; border-radius: 2pt; }
  pre { background: #f6f6f6; border: 1px solid #ddd; border-radius: 3pt; padding: 8pt; overflow-wrap: anywhere; white-space: pre-wrap; break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 8.5pt; }
  blockquote { border-left: 3px solid #bbb; padding: 2pt 10pt; color: #444; background: #fafafa; break-inside: avoid; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; break-inside: auto; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #ccc; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; }
  p:has(> img) { margin: 8pt 0 12pt; break-inside: avoid; }
  img { display: block; width: 100%; border: 1px solid #bbb; border-radius: 3pt; }
  em { color: #444; }
  hr { border: none; border-top: 1px solid #ccc; margin: 14pt 0; }
`;

const FOOTER = `
  <div style="width:100%; font-size:8px; color:#666; padding:0 18mm; display:flex; justify-content:space-between;">
    <span>MOVE — Manual de usuario</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>`;

function slugify(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

marked.use({
  gfm: true,
  renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens);
      const className = depth === 2 && /^parte /i.test(html.replace(/<[^>]*>/g, '')) ? ' class="part"' : '';
      return `<h${depth} id="${slugify(html)}"${className}>${html}</h${depth}>\n`;
    },
  },
});

function embedImages(html) {
  return html.replace(/src="(img\/[^"]+)"/g, (_, relativePath) => {
    const data = readFileSync(resolve(MANUAL_DIR, relativePath)).toString('base64');
    return `src="data:image/png;base64,${data}"`;
  });
}

async function main() {
  const body = embedImages(await marked.parse(readFileSync(SOURCE, 'utf8')));
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>MOVE — Manual de usuario</title><style>${STYLES}</style></head><body>${body}</body></html>`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.pdf({
      path: OUTPUT,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: FOOTER,
      margin: { top: '16mm', bottom: '18mm', left: '18mm', right: '18mm' },
    });
  } finally {
    await browser.close();
  }
  console.log(`• ${OUTPUT}`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exit(1);
});
