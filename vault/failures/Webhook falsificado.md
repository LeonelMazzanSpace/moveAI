---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/domain/webhook-signature.ts
---
# Webhook falsificado

Alguien llama al endpoint de notificaciones con un pago inventado. Defensa activa:
firma inválida responde 401 y el estado se re-consulta al proveedor.

## Structural
- causes → [[Plan activado sin pago confirmado]]
