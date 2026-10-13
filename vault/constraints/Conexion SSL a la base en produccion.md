---
type: constraint
status: built-off-by-default
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/config/database.config.ts
  - move/apps/api/.env.example
---
# Conexion SSL a la base en produccion

La config soporta `DB_SSL=true`, que Neon necesita, pero el default local es
`false`. En producción hay que activarlo.

## Structural
- constrains → [[Neon Postgres]]
