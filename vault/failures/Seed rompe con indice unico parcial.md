---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/database/seed-data.ts
---
# Seed rompe con indice unico parcial

Con el slug de planes pasado a índice único parcial, `ON CONFLICT (slug)` del seed dejó
de tener una restricción que lo respalde y Postgres rechazó la sentencia, rompiendo
todos los e2e que siembran el catálogo (bloqueo de T-039). Un `ON CONFLICT` sobre un
índice parcial tiene que repetir su `WHERE`.
