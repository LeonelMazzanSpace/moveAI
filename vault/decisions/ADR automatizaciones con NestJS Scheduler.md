---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
  - move/apps/api/src/common/scheduling/job-runner.service.ts
  - move/apps/api/src/modules/automations/automations.module.ts
---
# ADR automatizaciones con NestJS Scheduler

Las automatizaciones corren dentro de la API con `@nestjs/schedule` y leen sus
umbrales de PostgreSQL, sin colas ni infraestructura extra para el volumen inicial.

## Structural
- constrains → [[Modulo automatizaciones]]
- establishes → [[Reglas de automatizacion en Postgres]]
- establishes → [[Jobs programados idempotentes]]
- establishes → [[Scheduler corre en una sola instancia]]
