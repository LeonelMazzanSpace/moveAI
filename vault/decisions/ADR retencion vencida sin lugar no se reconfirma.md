---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
---
# ADR retencion vencida sin lugar no se reconfirma

D43, del review de T-013: confirmar el pago de una retención vencida falla con
`SLOT_FULL` si el turno ya no tiene lugar, si el cliente ya tiene otra reserva activa
en ese turno o si el turno ya empezó. Pagos lo trata como pago tardío sin lugar en vez
de revertir el webhook.

## Structural
- constrains → [[Modulo reservas]]
- requires → [[ADR pago tardio sin lugar queda para el staff]]
