---
type: constraint
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/domain/webhook-signature.ts
  - move/apps/api/src/modules/payments/controllers/webhook.controller.ts
  - move/apps/api/test/webhook.e2e-spec.ts
  - move/apps/api/test/auto-debits-webhook.e2e-spec.ts
---
# Pago confirmado solo por webhook validado

El estado de un pago de Mercado Pago se toma solo de una notificación con firma
`x-signature` válida, re-consultada en la API del proveedor, o de la conciliación;
nunca de la redirección del navegador. Una firma inválida responde 401 sin efectos.
Las otras vías de alta son el pago manual del staff y el simulador, que no existe en
producción. Los avisos de débito automático (`subscription_preapproval` y
`subscription_authorized_payment`) pasan por la misma firma y re-consulta.

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Webhook falsificado]]
- prevents → [[Plan activado sin pago confirmado]]
