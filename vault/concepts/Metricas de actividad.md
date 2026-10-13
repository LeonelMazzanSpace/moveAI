---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/apps/api/src/modules/bookings/domain/metrics.ts
  - move/apps/api/src/modules/bookings/services/activity-metrics.service.ts
---
# Metricas de actividad

Datos derivados por cliente: última asistencia, frecuencia semanal, cancelaciones,
ausencias sin aviso y uso de Rehab y Recovery. Son la base de seguimiento y
retención.

## Structural
- depends on → [[Asistencia]]
- depends on → [[Cancelacion]]
