---
type: system
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/dev-simulator.module.ts
  - move/apps/api/src/modules/payments/controllers/dev-simulator.controller.ts
  - move/apps/api/src/app.module.ts
  - move/apps/web/src/app/(public)/checkout/simulado/page.tsx
---
# Simulador de pagos de desarrollo

Reemplazo local de Mercado Pago mientras no hay credenciales: el checkout manda a una
página propia donde se aprueba o se rechaza el pago, y la API aplica el resultado por
el mismo camino que un pago real. Su módulo se registra solo cuando `NODE_ENV` no es
`production`.

## Structural
- is part of → [[Modulo pagos]]
