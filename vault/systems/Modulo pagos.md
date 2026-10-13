---
type: system
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/payments.module.ts
  - move/apps/api/src/modules/payments/services/checkout.service.ts
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/payments/controllers/webhook.controller.ts
  - move/apps/api/src/modules/payments/jobs/reconcile-payments.job.ts
---
# Modulo pagos

Checkout de planes y de reservas pagas (con invitado que crea la cuenta), webhook
firmado de Mercado Pago, conciliación periódica y pagos manuales del staff. Aplica el
pago aprobado activando la suscripción o confirmando la reserva en la misma
transacción.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Mercado Pago]]
- depends on → [[Modulo suscripciones]] because activa o renueva planes
- depends on → [[Modulo reservas]] because confirma reservas pagas de Rehab y Recovery
