---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
---
# Logica de negocio fuera de Mercado Pago

Vigencias, activaciones, renovaciones y confirmaciones viven en MOVE. Mercado Pago
solo cobra e informa el estado de cada pago.

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Logica de negocio acoplada al proveedor]]
