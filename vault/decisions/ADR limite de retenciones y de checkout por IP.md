---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/controllers/checkout.controller.ts
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
---
# ADR limite de retenciones y de checkout por IP

D53, del review transversal T-027 (I-3): como máximo 2 reservas pendientes de pago
por usuario y 10 inicios de checkout por minuto por IP, con `HOLD_LIMIT_REACHED` y
`RATE_LIMITED` sumados al contrato. Contar por IP abre el riesgo de ver a todos los
clientes con la IP del proxy.

## Structural
- establishes → [[Retenciones de pago limitadas por usuario]]
- establishes → [[Checkout publico limitado por IP]]
- enables → [[Throttling por IP ve la IP del proxy]]
