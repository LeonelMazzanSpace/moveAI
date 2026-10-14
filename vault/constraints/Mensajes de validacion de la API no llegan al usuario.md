---
type: constraint
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/src/lib/api/field-errors.ts
  - move/apps/web/src/lib/api/field-errors.test.ts
---
# Mensajes de validacion de la API no llegan al usuario

Los errores de campo de la API se traducen en la web a un mensaje fijo o por campo en
español con voseo; los tests mockean el texto real en inglés y afirman que no aparece.
Un único helper (`lib/api/field-errors.ts`) hace el mapeo para todos los formularios.

## Structural
- constrains → [[App web Next]]
- prevents → [[Mensajes de validacion en ingles visibles]]
