---
type: system
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/src/modules/payments/controllers/auto-debits.controller.ts
  - move/apps/api/src/modules/payments/entities/auto-debit.entity.ts
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
  - move/apps/api/src/database/migrations/1791994688446-AutoDebits.ts
  - move/apps/web/src/components/client/auto-debit-card.tsx
---
# Debito automatico

Tabla `auto_debits` dentro del módulo de pagos: un débito por cliente, plan y servicio,
con estado `pending`, `authorized` o `cancelled`, monto y frecuencia fijados al
contratar. Cada cobro aprobado es una compra nueva con `auto_debit_id` y su pago, y
activa o encadena el plan en la misma transacción. `plans.auto_debit_enabled` marca
qué planes lo permiten. Llega por webhook (`subscription_preapproval`,
`subscription_authorized_payment`) o por la conciliación; en desarrollo lo maneja el
simulador.

## Structural
- is part of → [[Modulo pagos]]
- depends on → [[Mercado Pago]]
- depends on → [[Modulo suscripciones]] because cada cobro activa o encadena el plan
