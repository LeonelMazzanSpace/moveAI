---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
---
# Renovacion de plan

Compra que crea una suscripción programada a continuación de la vigente, o una nueva
tras el vencimiento. Es el destino al que el sistema manda a quien quiere reservar con
el plan vencido.

## Structural
- is a case of → [[Compra]]
- depends on → [[Suscripcion]]
