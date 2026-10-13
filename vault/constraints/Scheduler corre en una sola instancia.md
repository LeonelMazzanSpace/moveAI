---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/common/scheduling/job-runner.service.ts
  - move/apps/api/src/config/scheduler.config.ts
  - move/apps/api/test/job-runner.e2e-spec.ts
---
# Scheduler corre en una sola instancia

Cada job toma un advisory lock de Postgres por nombre y se saltea si otro ya lo tiene,
aun entre instancias. Además `SCHEDULER_ENABLED=false` apaga los cron en una
instancia; el runbook pide dejarlos activos en una sola. Confirmada por el equipo
(D11).

## Structural
- constrains → [[NestJS Scheduler]]
- constrains → [[Modulo automatizaciones]]
- constrains → [[Modulo pagos]]
- prevents → [[Job ejecutado en varias instancias]]
