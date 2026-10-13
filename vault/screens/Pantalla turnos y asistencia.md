---
type: screen
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/imagenes/htmls/04-reservas-asistencia.html
  - move/apps/web/src/app/staff/turnos/page.tsx
  - move/apps/web/src/components/staff/turnos/roster-table.tsx
---
# Pantalla turnos y asistencia

Vista staff de un día: selector de turno, resumen (reservas y cupo, presentes,
ausentes, cancelaciones), tabla de alumnos con botones de asistencia, edición de cupo y
cancelación. Señala los turnos pasados con asistencia pendiente.

## Structural
- is part of → [[Panel staff web]]
- depends on → [[Modulo reservas]]
