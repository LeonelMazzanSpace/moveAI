---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# ADR automatizaciones con NestJS Scheduler

Las automatizaciones corren dentro de la API con `@nestjs/schedule` y leen reglas
de PostgreSQL, sin infraestructura extra para el volumen inicial.

## Structural
- constrains → [[Modulo automatizaciones]]
- establishes → [[Reglas de automatizacion en Postgres]]
- establishes → [[Jobs programados idempotentes]]
- establishes → [[Scheduler corre en una sola instancia]]
