---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/docs/manual/manual-de-usuario.md
  - move/docs/development.md
  - move/apps/api/.env.example
---
# Variables del ejemplo filtran PORT a la web

Cargar `apps/api/.env.example` como variables exportadas también en la consola de la
web le pasa `PORT=3001` a `next dev`, que intenta escuchar en el puerto de la API y
falla con `EADDRINUSE` (review de T-048, I-1). La guía "Probar MOVE en local" carga el
ejemplo solo en las consolas de la API y de los datos de demo.
