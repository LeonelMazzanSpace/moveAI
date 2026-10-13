---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/payments.service.ts
---
# ADR pago de plan rechazado deja la compra pendiente

D44, del review de T-017: en compras de plan, un pago rechazado no pasa la compra a
rechazada; queda pendiente para que un reintento aprobado en la misma preferencia
active el plan, y la expiración de 24 h cierra las abandonadas. En compras de reserva
el rechazo sigue liberando la retención.

## Structural
- constrains → [[Modulo pagos]]
