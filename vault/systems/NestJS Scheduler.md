---
type: system
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/config/scheduler.config.ts
  - move/apps/api/src/common/scheduling/job-runner.service.ts
---
# NestJS Scheduler

`@nestjs/schedule` dentro de la API, sin colas ni workers. Todos los cron (turnos,
retenciones, conciliación, seguimiento) pasan por el `JobRunner` común, que respeta
`SCHEDULER_ENABLED` y toma un advisory lock de Postgres por job.

## Structural
- is part of → [[API NestJS]]
