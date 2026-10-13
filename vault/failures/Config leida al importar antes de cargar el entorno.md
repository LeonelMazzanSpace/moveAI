---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/payments/dev-simulator.module.ts
---
# Config leida al importar antes de cargar el entorno

Un módulo de Nest que decide algo leyendo `process.env` al importarse corre antes de
que `ConfigModule` cargue `.env`. Con `NODE_ENV=production` solo en `.env`, el módulo
de pagos veía otro valor y montaba el simulador (review de T-034, D59). Fix: el
registro condicional pasó a `ConditionalModule.registerWhen` en `app.module.ts`, que
evalúa con el entorno ya cargado, con un spec que lo cubre.

## Structural
- causes → [[Simulador de pagos montado en produccion]]
