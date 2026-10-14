---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/src/config/database.config.ts
---
# Variable de entorno parseada una sola vez

Una variable de entorno se valida y se convierte con una sola función, y lo que usa la
app es ese valor convertido. Lo cumplen `TRUST_PROXY_HOPS` (D64) y, desde T-039,
`PORT` y `DB_PORT` (`parsePort`: solo dígitos 1–65535) y `DB_SSL` (solo `true` o
`false`); un valor raro como `8e3` o `DB_SSL=1` impide arrancar.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Variable de entorno parseada dos veces con reglas distintas]]
