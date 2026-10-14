---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/lib/api/field-errors.ts
---
# ADR errores de campo con copy propio

D77, de las reviews de T-046 y T-047: la web nunca muestra el texto de `details` de un
400 de la API (mensajes de class-validator en inglés, con nombres internos de campo).
Marca el campo con copy propio en español y alinea las cotas de Zod con las del DTO.

## Structural
- establishes → [[Mensajes de validacion de la API no llegan al usuario]]
- constrains → [[App web Next]]
