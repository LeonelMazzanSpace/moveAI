---
type: constraint
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p12
  - move/MOVE.pdf#p13
---
# Sin infraestructura extra en MVP

No se agregan servicios nuevos (colas, Redis, otro proveedor de email, IdP
administrado) mientras el volumen no lo justifique. Bull y Redis, el default de
SpaceDev, quedan fuera.

## Structural
- constrains → [[NestJS Scheduler]]
- mitigates → [[Desvio de alcance del MVP]]
