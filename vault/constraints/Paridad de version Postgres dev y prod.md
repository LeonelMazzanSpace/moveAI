---
type: constraint
status: proposed
semana: 1
updated: 2026-10-13
source:
  - move/docker-compose.yml
  - move/MOVE.pdf#p9
---
# Paridad de version Postgres dev y prod

La versión mayor de Postgres en Docker (17) coincide con la de Neon, para que las
migraciones probadas en local se comporten igual en producción.

## Structural
- constrains → [[Postgres local Docker]]
- mitigates → [[Drift de esquema entre ambientes]]
