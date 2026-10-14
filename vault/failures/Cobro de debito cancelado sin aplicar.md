---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/auto-debits-webhook.e2e-spec.ts
---
# Cobro de debito cancelado sin aplicar

La conciliación solo leía débitos `pending` o `authorized`. Sin webhooks (D68), un cobro
aprobado justo antes de que el cliente cancelara, o aprobado después de salir de
`in_process`, no lo veía nadie: el cliente pagaba y no quedaba compra ni plan
(review T-062, I-2).

## Structural
- causes → [[Pago aprobado sin activar plan]]
