---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# Pago tardio perdido tras expirar la compra

Cuando una retención se cancelaba, su compra pasaba a `expired` y la conciliación
dejaba de re-consultarla; si el cliente pagaba igual y el webhook se perdía, el pago
nunca se registraba (review de T-032, m-3). Fix (D60, ajustado en T-040): la
conciliación re-consulta las compras vencidas (reservas 72 horas, planes 7 días) y
marca para el staff las que ya no pueden ubicarse.

## Structural
- causes → [[Pago aprobado sin activar plan]]
