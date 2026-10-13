---
type: constraint
status: todo
semana: 4
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# Reglas de automatizacion en Postgres

Las reglas y fechas que evalúan los jobs (umbrales, re-contactos, check-ins
programados) se guardan en PostgreSQL. Los jobs las leen; no hay reglas en
código.

## Structural
- constrains → [[Modulo automatizaciones]]
