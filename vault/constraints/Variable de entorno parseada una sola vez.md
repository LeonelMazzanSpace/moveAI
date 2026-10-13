---
type: constraint
status: todo
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/src/config/database.config.ts
---
# Variable de entorno parseada una sola vez

Una variable de entorno se valida y se convierte con una sola función, y lo que usa la
app es ese valor convertido. `TRUST_PROXY_HOPS` ya lo cumple (D64); `PORT`, `DB_PORT`
y `DB_SSL` todavía se validan en un lugar y se vuelven a leer de `process.env` con otra
regla en su config.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Variable de entorno parseada dos veces con reglas distintas]]
