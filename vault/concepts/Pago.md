---
type: concept
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Pago

Operación de Mercado Pago asociada a una compra, con estado (pendiente, aprobado,
rechazado). Solo un pago aprobado y validado por el backend activa un plan o
confirma una reserva.

## Structural
- is part of → [[Compra]]
- depends on → [[Mercado Pago]]
- enables → [[Suscripcion]] because un pago aprobado la crea o la extiende
