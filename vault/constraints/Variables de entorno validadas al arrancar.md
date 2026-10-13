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

La API valida con class-validator todas las env vars al iniciar y no arranca si
falta o está mal alguna. La config se inyecta por namespace (`appConfig.KEY`,
`databaseConfig.KEY` con `ConfigType`), nunca con `process.env` en servicios.
Excepción: el CLI de migraciones (`data-source.ts`) lee `process.env` sin esa
validación.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Arranque con configuracion invalida]]
