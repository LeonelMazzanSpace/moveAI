---
type: system
status: built-off-by-default
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
  - move/apps/api/src/config/mercado-pago.config.ts
---
# Mercado Pago

Procesador de pagos de MOVE, integrado por su API REST desde un único service. Está
apagado hasta tener credenciales: sin `MP_ACCESS_TOKEN` el checkout usa el simulador
de desarrollo. En producción la API no arranca sin token ni secreto de webhook.
