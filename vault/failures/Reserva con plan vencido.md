---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
---
# Reserva con plan vencido

Un cliente sin plan vigente reserva un turno de Performance. Si se valida solo en el
front, cualquier llamada directa a la API lo logra. Defensa activa: `PLAN_REQUIRED`
en la API.
