---
type: constraint
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/src/modules/payments/entities/payment.entity.ts
  - move/apps/api/test/webhook.e2e-spec.ts
  - move/apps/api/test/auto-debits-webhook.e2e-spec.ts
---
# Operaciones de pago idempotentes

Procesar el mismo pago dos veces (webhook repetido, o webhook y conciliación) no
tiene efecto extra: el ID de pago del proveedor es único y la transición de la compra
a aprobada solo ocurre una vez, con un guard sobre el `UPDATE … RETURNING`.
Confirmada por el equipo (D11). Los cobros de [[Debito automatico]] son idempotentes por
`mp_payment_id` bajo un `FOR UPDATE` de la fila del débito, que serializa webhook,
conciliación y simulador; el link de pago de un débito solo se entrega si sigue
`pending` después de crearlo en Mercado Pago (T-070).

## Structural
- constrains → [[Modulo pagos]]
- requires → [[Queries crudas con RETURNING via CTE]] because el guard lee las filas devueltas
- prevents → [[Webhook duplicado procesado dos veces]]
