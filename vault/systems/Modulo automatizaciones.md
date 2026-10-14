---
type: system
status: shipped
semana: 4
updated: 2026-10-14
source:
  - move/apps/api/src/modules/automations/automations.module.ts
  - move/apps/api/src/modules/automations/services/automations.service.ts
  - move/apps/api/src/modules/automations/jobs/followup-detect.job.ts
  - move/apps/api/src/modules/automations/jobs/expiry-reminders.job.ts
  - move/apps/api/src/modules/automations/jobs/checkins-monthly.job.ts
  - move/apps/api/src/modules/automations/jobs/booking-reminders.job.ts
  - move/apps/api/src/modules/automations/controllers/staff-automations.controller.ts
---
# Modulo automatizaciones

Jobs programados de detección de alertas, avisos de vencimiento, check-in mensual y,
desde la tanda de comentarios, `booking-reminders` (18:00 de Montevideo, reservas
confirmadas de Rehab y Recovery del día siguiente). También expone un endpoint staff
que ejecuta un job en el momento. No tiene reglas propias: delega en seguimiento,
suscripciones, reservas y notificaciones, y corre a través del `JobRunner` compartido.

## Structural
- is part of → [[API NestJS]]
- depends on → [[NestJS Scheduler]]
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo notificaciones]]
