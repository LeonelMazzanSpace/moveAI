---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
---
# Cancelacion

Baja de una reserva, registrada con fecha y hora. El cliente cancela online solo
reservas de plan Performance, de paquete Recovery o de seguimiento, dentro del límite;
las pagas de forma individual las cancela el staff, sin reembolso automático (D20).
Alimenta las métricas de cancelaciones.

## Structural
- depends on → [[Reserva]]
- is part of → [[Modulo reservas]]
