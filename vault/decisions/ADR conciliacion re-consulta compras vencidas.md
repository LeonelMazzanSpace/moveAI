---
type: decision
status: superseded
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# ADR conciliacion re-consulta compras vencidas

D60, del review de T-032: la conciliación re-consulta las compras vencidas de plan y
de reserva dentro de los 7 días. Un pago tardío de reserva termina aprobado y marcado
para el staff solo si la reserva ya no puede ubicarse; una retención vencida con lugar
se re-confirma sin marca.

## Structural
- supersedes → [[ADR conciliacion de compras de plan vencidas]]
- requires → [[ADR pago tardio sin lugar queda para el staff]]
- constrains → [[Modulo pagos]]
