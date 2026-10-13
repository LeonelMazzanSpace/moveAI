---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/controllers/checkout.controller.ts
  - move/apps/api/test/hold-limits.e2e-spec.ts
---
# Retenciones masivas de invitados

Alguien inicia checkouts de invitado con emails nuevos y deja decenas de turnos
retenidos sin pagar desde una sola IP (review de T-027 I-3 y de T-031 R-2). Defensa
activa: tope de retenciones por usuario más límites por minuto y por hora por IP.

## Structural
- causes → [[Horario retenido por pago abandonado]]
