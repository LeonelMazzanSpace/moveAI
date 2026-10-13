---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/payments/dev-simulator.module.ts
  - move/apps/api/src/config/env.validation.ts
---
# Simulador de pagos solo fuera de produccion

El simulador se registra con `ConditionalModule.registerWhen`, que decide con
`NODE_ENV` ya cargado por `ConfigModule` (también desde `.env`): en `production` la
ruta no existe. Además, en producción la API no arranca sin credenciales reales de
Mercado Pago.

## Structural
- constrains → [[Simulador de pagos de desarrollo]]
- prevents → [[Simulador de pagos montado en produccion]]
