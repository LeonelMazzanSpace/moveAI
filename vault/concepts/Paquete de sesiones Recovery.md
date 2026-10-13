---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p5
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
  - move/apps/web/src/components/client/packs-card.tsx
---
# Paquete de sesiones Recovery

Plan Recovery con un número fijo de sesiones para un período de 30 días desde la
compra. A diferencia de Performance, lo que se consume son sesiones, no días de
vigencia.

## Structural
- is a case of → [[Plan]]
- depends on → [[Servicio Recovery]]
- is part of → [[Modulo suscripciones]] because guarda el saldo de sesiones del período

## Associative
- opens a question about → [[Prioridad de horarios Recovery]]
