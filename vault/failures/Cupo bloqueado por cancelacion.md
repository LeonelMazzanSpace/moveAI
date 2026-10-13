---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
---
# Cupo bloqueado por cancelacion

Una reserva cancelada sigue contando para el cupo y el turno figura "Completo" con
lugares libres. Defensa activa: el cupo cuenta solo reservas activas.
