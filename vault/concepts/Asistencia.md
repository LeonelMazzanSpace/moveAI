---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/entities/attendance.entity.ts
  - move/apps/api/src/modules/bookings/services/attendance.service.ts
---
# Asistencia

Resultado real de una reserva, cargado por el staff una vez empezado el turno.
Separarla de la reserva es lo que permite saber quién vino de verdad.

## Structural
- depends on → [[Reserva]]
- is part of → [[Modulo reservas]]

## Associative
- contrasts with → [[Reserva]]
