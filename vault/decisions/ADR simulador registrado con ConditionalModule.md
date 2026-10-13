---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/payments/dev-simulator.module.ts
---
# ADR simulador registrado con ConditionalModule

D59, del review de T-034: el módulo del simulador de pagos se registra desde
`app.module.ts` con `ConditionalModule.registerWhen`, que evalúa `NODE_ENV` con el
entorno ya cargado, en lugar de leer `process.env` al importar el módulo de pagos.

## Structural
- requires → [[ADR desarrollo sin accesos a proveedores]]
- establishes → [[Simulador de pagos solo fuera de produccion]]
