---
type: system
status: shipped
semana: 1
updated: 2026-10-14
source:
  - move/apps/api/src/modules/schedule/agenda.module.ts
  - move/apps/api/src/modules/schedule/services/schedule.service.ts
  - move/apps/api/src/modules/schedule/services/templates.service.ts
  - move/apps/api/src/modules/schedule/domain/slot-generation.ts
  - move/apps/api/src/modules/schedule/jobs/generate-slots.job.ts
  - move/apps/api/src/modules/schedule/entities/time-slot.entity.ts
---
# Modulo agenda

Calendario propio en `modules/schedule`: profesionales, plantillas semanales y una
sola tabla `time_slots` para los turnos de los tres servicios. Performance y Recovery
se generan desde plantillas con un job; Rehab son turnos de un profesional con cupo 1.
El staff edita cupos y crea turnos sueltos. `time_slots.calendar_blocked_at` marca los
turnos de Rehab ocupados en [[Google Calendar]].

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo configuracion]] because ventana de reserva y valores operativos
