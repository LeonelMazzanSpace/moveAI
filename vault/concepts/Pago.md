---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/entities/payment.entity.ts
---
# Pago

Operación asociada a una compra, de Mercado Pago o manual del staff (efectivo o
transferencia), con estado. Solo un pago aprobado y validado por el backend activa un
plan o confirma una reserva.

## Structural
- is part of → [[Compra]]
- depends on → [[Mercado Pago]]
- enables → [[Suscripcion]] because un pago aprobado la crea o la extiende
