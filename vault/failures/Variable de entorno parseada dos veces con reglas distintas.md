---
type: failure
status: todo
updated: 2026-10-13
source:
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/src/config/database.config.ts
---
# Variable de entorno parseada dos veces con reglas distintas

La validación acepta un valor con una regla y la config lo vuelve a leer con otra:
`TRUST_PROXY_HOPS=50e-1` se validaba como 5 pero Express recibía 50 y confiaba en
todo el header (review de T-036, D64). Fix para esa variable: un único parser
compartido. Sigue latente en `PORT`, `DB_PORT` y `DB_SSL`, que se leen otra vez con
`parseInt` o comparación de texto; queda como deuda.
