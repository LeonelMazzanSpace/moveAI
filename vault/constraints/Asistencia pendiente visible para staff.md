---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/web/src/components/staff/turnos/pending-attendance-banner.tsx
  - move/apps/web/src/components/staff/turnos/turnos-view.tsx
---
# Asistencia pendiente visible para staff

Los turnos pasados con alumnos sin marcar quedan señalados en Turnos y asistencia
hasta que se carguen. Si la carga de asistencia se olvida, las métricas de retención
no sirven. Confirmada por el equipo (D11).

## Structural
- constrains → [[Panel staff web]]
- mitigates → [[Asistencia no registrada]]
