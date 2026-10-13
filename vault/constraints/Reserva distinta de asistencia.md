---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/entities/attendance.entity.ts
  - move/apps/api/src/modules/bookings/services/activity-metrics.service.ts
---
# Reserva distinta de asistencia

Reserva y asistencia son registros separados: reservar no implica asistir. El staff
carga la asistencia por turno y las métricas se calculan solo con asistencias.

## Structural
- constrains → [[Asistencia]]
- constrains → [[Metricas de actividad]]
