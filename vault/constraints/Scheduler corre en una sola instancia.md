---
type: constraint
status: proposed
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p12
---
# Scheduler corre en una sola instancia

Si Elastic Beanstalk escala a más de una instancia, solo una ejecuta los cron:
con un advisory lock de Postgres, un flag de entorno en una sola instancia o un
worker environment.

## Structural
- constrains → [[NestJS Scheduler]]
- constrains → [[Modulo automatizaciones]]
- constrains → [[Modulo pagos]]
- prevents → [[Job ejecutado en varias instancias]]
