---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# ADR conciliacion de reservas vencidas por 72 horas

T-040 y D71: la conciliación re-consulta en Mercado Pago las compras de reserva vencidas
durante 72 horas desde su creación y las de plan durante 7 días; las compras rechazadas
no se re-consultan (decisión del usuario). El estado de compra expone `planSlug` para
que el reintento de un plan rechazado vaya directo a su checkout.

## Structural
- supersedes → [[ADR conciliacion re-consulta compras vencidas]]
- requires → [[ADR pago tardio sin lugar queda para el staff]]
- constrains → [[Modulo pagos]]
