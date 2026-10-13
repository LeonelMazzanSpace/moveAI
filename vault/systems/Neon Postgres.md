---
type: system
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p13
  - move/docs/deploy.md
---
# Neon Postgres

PostgreSQL administrado que MOVE ya usa. La plataforma nueva usa una base propia
dentro de Neon, sin depender del esquema anterior. Todavía no está configurado: las
migraciones y la semilla corren con el CLI del build de la API cuando haya acceso.
