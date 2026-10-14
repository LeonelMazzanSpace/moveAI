// Usage: pnpm --filter @move/api emails:preview
// Renders every email template with sample data (and the default contact footer) into apps/api/tmp/email-preview/,
// plus an index.html that links to them. It needs no database and no network.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CONTACT_DEFAULTS } from '../modules/settings/settings.defaults.js';
import { renderEmail, type EmailTemplate } from '../modules/notifications/templates/index.js';
import { PREVIEW_FIXTURES } from '../modules/notifications/templates/preview-fixtures.js';

const OUTPUT_DIR = fileURLToPath(new URL('../../tmp/email-preview/', import.meta.url));

const { address, hours, whatsapp, instagram, email } = CONTACT_DEFAULTS;
const footer = { address, hours, whatsapp, instagram, email };

const escapeText = (value: string): string => value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`);

mkdirSync(OUTPUT_DIR, { recursive: true });

const templates = Object.keys(PREVIEW_FIXTURES) as EmailTemplate[];
const links = templates.map((template) => {
  const { subject, html } = renderEmail(template, PREVIEW_FIXTURES[template] as never, footer);
  writeFileSync(`${OUTPUT_DIR}${template}.html`, html);
  return `<li><a href="${template}.html">${template}</a> — ${escapeText(subject)}</li>`;
});

writeFileSync(
  `${OUTPUT_DIR}index.html`,
  `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Vista previa de emails</title></head><body><h1>Emails de MOVE</h1><ul>${links.join('')}</ul></body></html>`,
);

console.log(`${templates.length} templates rendered to ${OUTPUT_DIR}`);
