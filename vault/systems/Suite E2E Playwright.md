---
type: system
status: shipped
updated: 2026-10-13
source:
  - move/playwright.config.ts
  - move/e2e/fixtures.ts
  - move/scripts/e2e/reset.mjs
  - move/tsconfig.e2e.json
---
# Suite E2E Playwright

Pruebas de navegador de la web contra la API reales, en desktop y mobile. `pnpm
e2e:reset` recrea la base de pruebas y `pnpm test:e2e:web` levanta API y web de
producción con `webServer`. Cada test crea sus propios clientes, turnos y compras, con
fechas relativas a Montevideo; `pnpm lint` incluye su type-check y lint.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[App web Next]]
- depends on → [[API NestJS]]
- depends on → [[Postgres local Docker]]
