---
type: screen
status: shipped
semana: 3
updated: 2026-10-14
source:
  - move/imagenes/htmls/04-reservas-asistencia.html
  - move/apps/web/src/app/staff/turnos/page.tsx
  - move/apps/web/src/components/staff/turnos/roster-table.tsx
  - move/apps/web/src/components/staff/turnos/slot-chips.tsx
---
# Pantalla turnos y asistencia

Vista staff de un día: selector de turno, resumen (reservas y cupo, presentes,
ausentes, cancelaciones), tabla de alumnos con botones de asistencia, edición de cupo y
cancelación. Señala los turnos pasados con asistencia pendiente. Los turnos de Rehab
ocupados en Google llevan el badge "Ocupado en Google Calendar", destacado como
conflicto si además tienen reserva (D95, D116).

## Structural
- is part of → [[Panel staff web]]
- depends on → [[Modulo reservas]]
