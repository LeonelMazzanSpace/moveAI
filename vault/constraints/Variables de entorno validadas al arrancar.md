---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/src/app.module.ts
---
# Variables de entorno validadas al arrancar

La API valida con class-validator todas las env vars al iniciar y no arranca si falta
o está mal alguna; en producción exige además las credenciales de Mercado Pago y
Brevo. La config se inyecta por namespace, nunca con `process.env` en services ni al
importar un módulo. Excepción: el CLI de migraciones lee `process.env` sin esa
validación.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Arranque con configuracion invalida]]
- mitigates → [[Config leida al importar antes de cargar el entorno]]
