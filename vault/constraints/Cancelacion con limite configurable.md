---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
  - move/apps/api/src/modules/settings/settings.defaults.ts
---
# Cancelacion con limite configurable

El cliente cancela solo hasta `cancel_limit_hours` antes del turno (2 h provisorio,
D10); pasado el plazo la API responde `CANCEL_WINDOW_CLOSED`. El staff edita el valor
en Configuración y el definitivo lo tiene que confirmar MOVE.

## Structural
- constrains → [[Cancelacion]]
- prevents → [[Cancelacion fuera de plazo aceptada]]

## Associative
- opens a question about → [[Accesos y definiciones operativas al inicio]]
