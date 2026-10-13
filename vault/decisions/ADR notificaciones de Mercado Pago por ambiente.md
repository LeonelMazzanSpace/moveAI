---
type: decision
status: draft
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/docs/manual/manual-de-usuario.md
  - move/docs/deploy.md
  - move/apps/api/src/modules/payments/controllers/webhook.controller.ts
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
---
# ADR notificaciones de Mercado Pago por ambiente

D68, abierta: con `notification_url` en cada preferencia Mercado Pago también manda
avisos IPN sin firma, que la API responde 401, y no está documentado que esa URL
traiga `x-signature`. Opciones: responder 200 sin efectos a lo que no es un pago
firmado, o quitar `notification_url` y usar la URL del panel con una aplicación por
ambiente. Recomendada la segunda, confirmada con un pago real. Decide el usuario
antes de producción.

## Structural
- constrains → [[Modulo pagos]]

## Associative
- opens a question about → [[Pago confirmado solo por webhook validado]]
