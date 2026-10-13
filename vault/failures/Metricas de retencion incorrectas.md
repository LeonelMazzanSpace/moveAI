---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/bookings/services/activity-metrics.service.ts
---
# Metricas de retencion incorrectas

Última asistencia y frecuencia no reflejan la realidad: el panel muestra clientes
activos como inactivos o al revés. Defensa activa: métricas solo con asistencias, sin
clientes borrados ni staff en los KPIs (D48).

## Structural
- causes → [[Alertas de inactividad falsas]]
