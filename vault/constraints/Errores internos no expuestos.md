---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/common/errors/all-exceptions.filter.ts
  - move/apps/api/src/common/errors/error-codes.ts
  - move/apps/api/src/common/errors/app-error.ts
---
# Errores internos no expuestos

Estándar SpaceDev. Toda respuesta de error sale de un filtro global con un código del
contrato y un mensaje genérico; los errores desconocidos son 500 `INTERNAL_ERROR` con
el detalle solo en el log. Nunca viajan stack traces, SQL ni errores del proveedor.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Detalles internos expuestos en respuestas]]
