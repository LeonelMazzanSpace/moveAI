---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# Activacion en la misma transaccion que el pago

Registrar el pago aprobado, mover la compra y activar el plan (o confirmar la
reserva) se escriben en una sola transacción; los emails salen después del commit.
Nunca queda un pago aprobado sin su efecto, ni un efecto sin pago. Confirmada por el
equipo (D11).

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Pago aprobado sin activar plan]]
