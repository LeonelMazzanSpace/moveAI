---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
---
# Errores internos no expuestos

Estándar SpaceDev. Las respuestas de error usan excepciones HTTP de Nest con
mensajes genéricos. Un filtro global evita que se filtren stack traces, SQL o errores
del proveedor.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Detalles internos expuestos en respuestas]]
