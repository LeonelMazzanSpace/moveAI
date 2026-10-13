---
type: constraint
status: proposed
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Activacion en la misma transaccion que el pago

Marcar el pago como aprobado y activar el plan (o confirmar la reserva) se
escriben en una sola transacción. Nunca queda un pago aprobado sin su efecto, ni un
efecto sin pago.

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Pago aprobado sin activar plan]]
