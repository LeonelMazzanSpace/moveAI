---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/payments/entities/purchase.entity.ts
---
# ADR pago tardio sin lugar queda para el staff

D23: si un pago se aprueba después de que venció la retención y el turno ya no tiene
lugar, la compra queda aprobada con `needs_attention` y el staff la resuelve a mano,
sin reembolso automático. Evita revertir un cobro real o sobrevender el turno.

## Structural
- constrains → [[Modulo pagos]]
- constrains → [[Pantalla pagos staff]]
