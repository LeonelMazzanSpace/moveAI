import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const APP = join(SRC, 'app');
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
const IMPORT_PATTERN = /import\s+(?!type\b)([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
const REEXPORT_PATTERN = /export\s+(?!type\b)(\*(?:\s+as\s+\w+)?|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isClientModule(source: string): boolean {
  return /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*['"]use client['"]/.test(source);
}

/** Módulos sin `'use client'` (pages, layouts, loading, route handlers, componentes y helpers compartidos), sin tests. */
function serverModules(): string[] {
  return walk(SRC)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter((file) => !isClientModule(readFileSync(file, 'utf8')));
}

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/') ? join(SRC, specifier.slice(2)) : specifier.startsWith('.') ? resolve(dirname(from), specifier) : null;
  if (!base) return null;
  const candidates = [base, ...EXTENSIONS.map((extension) => `${base}${extension}`)];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

/** Lo que `clause` trae de un módulo, sin los tipos: nombres, o `* as ns` / `*` para namespaces y `export *`. */
function importedValues(clause: string): string[] {
  const names: string[] = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  for (const part of clause.replace(/\{[^}]*\}/, '').split(',')) {
    const trimmed = part.trim().replace(/\s+/g, ' ');
    if (trimmed) names.push(trimmed);
  }
  for (const entry of (braces?.[1] ?? '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith('type ')) continue;
    names.push(trimmed.split(/\s+as\s+/)[0] ?? trimmed);
  }
  return names;
}

/** Funciones (camelCase), constantes (UPPER_CASE) y namespaces; los componentes (PascalCase) sí cruzan la frontera. */
function isValueName(name: string): boolean {
  return name.startsWith('*') || /^[a-z]/.test(name) || /^[A-Z][A-Z0-9_]+$/.test(name);
}

/** Valores que `source` importa o reexporta de módulos `'use client'`. */
function clientValueImports(file: string, source: string): string[] {
  const violations: string[] = [];
  for (const match of [...source.matchAll(IMPORT_PATTERN), ...source.matchAll(REEXPORT_PATTERN)]) {
    const [, clause = '', specifier = ''] = match;
    const target = resolveModule(file, specifier);
    if (!target || !isClientModule(readFileSync(target, 'utf8'))) continue;
    for (const name of importedValues(clause)) {
      if (isValueName(name)) violations.push(`${name} from ${specifier}`);
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

  it('flags UPPER_CASE constants, namespace imports and re-exports from a client module', () => {
    const file = join(APP, 'staff', 'pagos', 'page.tsx');
    const view = '@/components/staff/pagos/payments-view';

    expect(clientValueImports(file, `import { METHOD_LABEL, PaymentsView } from '${view}';`)).toEqual([`METHOD_LABEL from ${view}`]);
    expect(clientValueImports(file, `import * as payments from '${view}';`)).toEqual([`* as payments from ${view}`]);
    expect(clientValueImports(file, `export { clampPage, PaymentsView } from '${view}';`)).toEqual([`clampPage from ${view}`]);
    expect(clientValueImports(file, `export * from '${view}';`)).toEqual([`* from ${view}`]);
    expect(clientValueImports(file, `export { PaymentsView, type PaymentFilters } from '${view}';`)).toEqual([]);
  });

  it('checks every server module, not only pages and layouts', () => {
    const files = serverModules().map((file) => file.slice(SRC.length + 1));
    expect(files).toContain(join('components', 'move', 'plan-card.tsx'));
    expect(files).toContain(join('lib', 'api', 'server.ts'));
    expect(files).not.toContain(join('app', 'providers.tsx'));
    expect(files.some((file) => /\.test\.tsx?$/.test(file))).toBe(false);
  });

  it('does not let server modules call functions or read constants exported by a client module', () => {
    const offenders = serverModules().flatMap((file) =>
      clientValueImports(file, readFileSync(file, 'utf8')).map((item) => `${file.slice(SRC.length + 1)}: ${item}`),
    );

    expect(offenders).toEqual([]);
  });
});
