---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.setup.ts
---
# Datos invalidos en la base

Entra a la base un payload sin validar o con campos extra. Defensa activa: pipe
global y un DTO acotado por endpoint.
