---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/subscriptions/entities/subscription.entity.ts
---
# Suscripcion

Plan contratado por un cliente, con fechas de inicio y fin (fechas de negocio) y, en
paquetes, saldo de sesiones. Es la fuente de verdad de "plan vigente": nace o se
programa con un pago aprobado.

## Structural
- depends on → [[Plan]]
- is part of → [[Modulo suscripciones]]
