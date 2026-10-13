---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/domain/webhook-signature.ts
---
# Plan activado sin pago confirmado

Un plan o reserva se activa sin un pago aprobado real en Mercado Pago. Defensa
activa: firma del webhook y re-consulta al proveedor; el simulador no existe en
producción.
