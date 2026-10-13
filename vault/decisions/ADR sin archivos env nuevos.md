---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/.env.example
  - move/scripts/manual/demo-data.mjs
---
# ADR sin archivos env nuevos

D61, decidida por el usuario: no se crean archivos `.env` nuevos; los procesos toman
los valores de `apps/api/.env.example` como variables de entorno exportadas, y los
scripts del manual funcionan sin `apps/api/.env`. Exportar ese archivo deja
`NODE_ENV=development` en el shell, lo que rompe el build de la web.

## Structural
- constrains → [[Manual de usuario]]
- enables → [[Build de Next falla con NODE_ENV development]]
