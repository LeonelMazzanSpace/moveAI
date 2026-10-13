---
type: decision
status: superseded
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/payments.service.ts
---
# ADR conciliacion de compras de plan vencidas

D45, del review de T-017: la conciliación también re-consultaba las compras de plan
vencidas de los últimos 7 días, para aplicar pagos offline tardíos. Reemplazada por
D60, que extiende la regla a las compras de reserva.

## Structural
- constrains → [[Modulo pagos]]
