import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const APP = join(SRC, 'app');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const IMPORT_PATTERN = /import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isClientModule(source: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(source);
}

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? join(SRC, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  const candidates = [base, ...EXTENSIONS.map((extension) => `${base}${extension}`)];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Identificadores de valor (no tipos) que `clause` trae de un módulo. */
function importedValues(clause: string): string[] {
  const names: string[] = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  const defaultPart = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
  if (defaultPart && !defaultPart.startsWith('*')) names.push(defaultPart);
  for (const entry of (braces?.[1] ?? '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith('type ')) continue;
    names.push(trimmed.split(/\s+as\s+/)[0] ?? trimmed);
  }
  return names;
}

/** Imports de funciones o constantes (minúscula) que `source` toma de módulos `'use client'`. */
function clientValueImports(file: string, source: string): string[] {
  const violations: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const [, clause = '', specifier = ''] = match;
    const target = resolveModule(file, specifier);
    if (!target || !isClientModule(readFileSync(target, 'utf8'))) continue;
    for (const name of importedValues(clause)) {
      if (/^[a-z]/.test(name)) violations.push(`${name} from ${specifier}`);
    }
  }
  return violations;
}

describe('server/client boundary', () => {
  it('flags a lowercase value imported from a client module, but not components or types', () => {
    const file = join(APP, 'staff', 'pagos', 'page.tsx');
    const view = '@/components/staff/pagos/payments-view';

    expect(clientValueImports(file, `import { clampPage, PaymentsView } from '${view}';`)).toEqual([`clampPage from ${view}`]);
    expect(clientValueImports(file, `import { PaymentsView, type PaymentFilters } from '${view}';`)).toEqual([]);
    expect(clientValueImports(file, `import type { clampPage } from '${view}';`)).toEqual([]);
  });

  it('does not let Server Components call functions or read constants exported by a client module', () => {
    const offenders = walk(APP)
      .filter((file) => /[\\/](page|layout)\.tsx$/.test(file))
      .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
      .filter(({ source }) => !isClientModule(source))
      .flatMap(({ file, source }) => clientValueImports(file, source).map((item) => `${file.slice(APP.length + 1)}: ${item}`));

    expect(offenders).toEqual([]);
  });
});
