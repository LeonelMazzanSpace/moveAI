---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/apps/api/src/common/scheduling/job-runner.service.ts
---
# Job ejecutado en varias instancias

Con Elastic Beanstalk en dos o más instancias, cada una corre los mismos cron al
mismo tiempo. Defensa activa: advisory lock por job y `SCHEDULER_ENABLED`.

## Structural
- causes → [[Alertas o emails duplicados]]
