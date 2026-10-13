---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/payments/controllers/dev-simulator.controller.ts
---
# Simulador de pagos montado en produccion

La ruta del simulador existe en producción y cualquiera puede aprobar una compra sin
pagar. Defensa activa: el módulo se registra solo fuera de `production`, decidido con
el entorno ya cargado.

## Structural
- causes → [[Plan activado sin pago confirmado]]
