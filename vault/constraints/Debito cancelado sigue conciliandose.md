---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/auto-debits-webhook.e2e-spec.ts
---
# Debito cancelado sigue conciliandose

Durante 40 días después de cancelarse en MOVE, un débito con suscripción en Mercado
Pago sigue entrando en la conciliación: si MP lo reporta todavía activo, se vuelve a
cancelar allá (también al llegar un aviso), y sus cobros aprobados se aplican una sola
vez. Un débito reemplazado o cancelado mientras MP fallaba no queda cobrando ni pierde
un cobro sin aviso (T-062, review I-1 e I-2).

## Structural
- constrains → [[Debito automatico]]
- requires → [[Operaciones de pago idempotentes]] because webhook y conciliación pueden ver el mismo cobro
- prevents → [[Debito reemplazado cobrado en paralelo]]
- prevents → [[Cobro de debito cancelado sin aplicar]]
