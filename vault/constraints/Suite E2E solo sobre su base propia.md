---
type: constraint
status: shipped
updated: 2026-10-13
source:
  - move/scripts/e2e/env.mjs
  - move/e2e/support/sql.ts
  - move/scripts/e2e/reset.mjs
---
# Suite E2E solo sobre su base propia

Todo punto de entrada de la suite (config, reset, SQL directo de preparación) rechaza
una base cuyo nombre no empiece con `move_e2e` y un `DB_HOST` o `DB_PORT` que no sean
los del contenedor local. Así la suite nunca escribe usuarios ni compras en la base de
la app que el desarrollador tiene corriendo.

## Structural
- constrains → [[Suite E2E Playwright]]
- prevents → [[Suite E2E escribe en una base real]]
