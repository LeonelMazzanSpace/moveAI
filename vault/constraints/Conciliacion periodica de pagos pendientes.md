---
type: constraint
status: proposed
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# Conciliacion periodica de pagos pendientes

Un cron del módulo de pagos consulta a Mercado Pago los pagos que siguen
pendientes después de X minutos y aplica su estado real. Cubre los webhooks que nunca
llegaron o se rechazaron. Adelanta el scheduler a la semana 2 (el PDF lo pone en la
4).

## Structural
- constrains → [[Modulo pagos]]
- requires → [[Operaciones de pago idempotentes]] because webhook y conciliación pueden aplicar el mismo pago
- requires → [[Scheduler corre en una sola instancia]]
- mitigates → [[Pago aprobado sin activar plan]]
- mitigates → [[Webhook legitimo rechazado]]

## Associative
- resembles → [[Jobs programados idempotentes]]
