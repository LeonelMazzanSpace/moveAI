---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/lib/api/types.ts
  - move/apps/api/src/common/errors/error-codes.ts
---
# Contrato front-back definido antes de implementar

Las rutas, formas de respuesta y códigos de error se fijaron en el contrato HTTP del
plan antes de implementar, y la web toma sus tipos de un único archivo. En el MVP no
hay Swagger: el contrato del plan es la fuente (D19).

## Structural
- constrains → [[API NestJS]]
- constrains → [[App web Next]]
- prevents → [[Desalineacion entre front y back]]
