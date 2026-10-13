---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/apps/api/src/database/entities.ts
---
# Entidad ORM expuesta en la API

Un endpoint devuelve una entidad TypeORM directamente, con columnas internas y
relaciones de más. Defensa activa: modelos planos y respuestas con la forma del
contrato.

## Structural
- causes → [[Detalles internos expuestos en respuestas]]
