---
type: system
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/automations/automations.module.ts
  - move/apps/api/src/modules/automations/services/automations.service.ts
  - move/apps/api/src/modules/automations/jobs/followup-detect.job.ts
  - move/apps/api/src/modules/automations/jobs/expiry-reminders.job.ts
  - move/apps/api/src/modules/automations/jobs/checkins-monthly.job.ts
  - move/apps/api/src/modules/automations/controllers/staff-automations.controller.ts
---
# Modulo automatizaciones

Jobs programados de detección de alertas, avisos de vencimiento y check-in mensual,
más un endpoint staff que ejecuta un job en el momento. No tiene reglas propias:
delega en seguimiento, suscripciones y notificaciones, y corre a través del
`JobRunner` compartido.

## Structural
- is part of → [[API NestJS]]
- depends on → [[NestJS Scheduler]]
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo notificaciones]]
