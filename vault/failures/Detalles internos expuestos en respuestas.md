---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
  - move/apps/api/src/common/errors/all-exceptions.filter.ts
---
# Detalles internos expuestos en respuestas

Una respuesta de error devuelve stack traces, SQL o el error crudo del
proveedor. Defensa activa: filtro global con códigos y mensajes genéricos.
