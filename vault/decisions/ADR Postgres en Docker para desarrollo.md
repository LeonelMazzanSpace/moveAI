---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docker-compose.yml
---
# ADR Postgres en Docker para desarrollo

En desarrollo toda la base corre en Docker local (Postgres 17) y no se apunta a
Neon desde la máquina de nadie.

## Structural
- constrains → [[Postgres local Docker]]
- establishes → [[Paridad de version Postgres dev y prod]]
