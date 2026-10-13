---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/schedule/services/schedule.service.ts
  - move/apps/web/src/components/booking/slot-grid.tsx
---
# Cupo maximo por horario

Cada turno tiene un cupo editable por el staff (nunca menor a las reservas activas).
Al llenarse, la web muestra "Completo" y la API responde `SLOT_FULL`.

## Structural
- constrains → [[Horario]]
- mitigates → [[Sobreventa de cupos]]
