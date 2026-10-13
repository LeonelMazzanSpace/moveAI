---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/entities/booking.entity.ts
---
# Reserva

Lugar tomado por un cliente en un turno. Para Performance requiere plan vigente; con
paquete Recovery consume una sesión; para Rehab y Recovery individual nace como
retención pendiente de pago. No es lo mismo que asistir.

## Structural
- depends on → [[Horario]]
- depends on → [[Usuario]]
- is part of → [[Modulo reservas]]
