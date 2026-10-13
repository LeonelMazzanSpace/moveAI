---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/test/webhook.e2e-spec.ts
---
# Webhook duplicado procesado dos veces

Mercado Pago reintenta la notificación y el backend aplica el pago otra vez.
Defensa activa: operaciones de pago idempotentes.

## Structural
- causes → [[Vigencia extendida dos veces]]
- causes → [[Alertas o emails duplicados]]
