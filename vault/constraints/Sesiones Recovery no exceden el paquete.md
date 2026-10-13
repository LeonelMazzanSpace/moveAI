---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/subscriptions/services/subscriptions.service.ts
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
---
# Sesiones Recovery no exceden el paquete

Una reserva con paquete Recovery descuenta una sesión del período con un `UPDATE`
condicionado al saldo, y sin saldo la API responde `PACKAGE_REQUIRED`. El período es
de 30 días desde la compra y las sesiones no usadas vencen al final (D8).

## Structural
- constrains → [[Paquete de sesiones Recovery]]
- prevents → [[Paquete Recovery sobreconsumido]]
