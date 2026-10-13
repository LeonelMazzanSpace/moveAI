---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/main.ts
---
# Datos invalidos en la base

Entra a la base un payload sin validar o con campos extra. Defensa activa: pipe
global, aunque todavía no hay DTOs de dominio.
