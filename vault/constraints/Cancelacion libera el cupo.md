---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/test/bookings.e2e-spec.ts
---
# Cancelacion libera el cupo

El cupo se cuenta con las reservas activas, así que una reserva cancelada deja de
contar en la misma transacción y el lugar vuelve a estar disponible. Queda registrada
con fecha y hora para métricas, no se borra. Confirmada por el equipo (D11).

## Structural
- constrains → [[Cancelacion]]
- prevents → [[Cupo bloqueado por cancelacion]]
