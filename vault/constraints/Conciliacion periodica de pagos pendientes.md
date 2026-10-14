---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/jobs/reconcile-payments.job.ts
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/settings/settings.defaults.ts
---
# Conciliacion periodica de pagos pendientes

Cada 10 minutos un job consulta a Mercado Pago las compras pendientes con más de
`reconcile_after_minutes` y aplica su estado real. También re-consulta las compras
vencidas, de reserva durante 72 horas y de plan durante 7 días, para no perder pagos
tardíos; las rechazadas no se re-consultan (D60, T-040). Cubre los webhooks que nunca
llegaron o se rechazaron.

## Structural
- constrains → [[Modulo pagos]]
- requires → [[Operaciones de pago idempotentes]] because webhook y conciliación pueden aplicar el mismo pago
- requires → [[Scheduler corre en una sola instancia]]
- mitigates → [[Pago aprobado sin activar plan]]
- mitigates → [[Webhook legitimo rechazado]]
- prevents → [[Pago tardio perdido tras expirar la compra]]

## Associative
- resembles → [[Jobs programados idempotentes]]
