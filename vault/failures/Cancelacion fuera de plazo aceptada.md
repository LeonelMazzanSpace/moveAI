---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
---
# Cancelacion fuera de plazo aceptada

El sistema deja cancelar después del límite y el cupo queda vacío sin tiempo de
reasignarlo. Defensa activa: `CANCEL_WINDOW_CLOSED` en la API.
