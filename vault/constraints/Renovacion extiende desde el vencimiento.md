---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
  - move/apps/api/test/subscriptions.e2e-spec.ts
---
# Renovacion extiende desde el vencimiento

Si un plan se renueva antes de vencer, el período nuevo queda programado desde el
vencimiento actual, no desde la fecha de pago. Si ya venció, arranca el día del pago.
Confirmada por el equipo (D11).

## Structural
- constrains → [[Renovacion de plan]]
- prevents → [[Dias de plan perdidos al renovar]]
