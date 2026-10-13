---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/dto/mark-attendance.dto.ts
  - move/apps/web/src/components/staff/turnos/attendance-buttons.tsx
---
# Estados de asistencia

Resuelto (D5): tres estados, presente, ausente (avisó fuera de plazo) y no show (no
avisó); sin marcar es "Pendiente". Ninguno tiene penalidad en el MVP.

## Structural
- is part of → [[Asistencia]]

## Associative
- opens a question about → [[Metricas de actividad]]
