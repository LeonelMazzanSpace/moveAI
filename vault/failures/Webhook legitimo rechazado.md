---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/controllers/webhook.controller.ts
  - move/apps/api/src/modules/payments/jobs/reconcile-payments.job.ts
---
# Webhook legitimo rechazado

La validación de firma rechaza notificaciones reales (secreto equivocado,
credenciales de prueba contra producción, o avisos IPN sin firma que Mercado Pago
también manda a la `notification_url`) y los pagos aprobados no se aplican por esa
vía. Mitigada por la conciliación; el formato de notificaciones sigue abierto (D68).

## Structural
- causes → [[Pago aprobado sin activar plan]]
