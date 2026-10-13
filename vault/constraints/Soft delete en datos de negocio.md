---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
---
# Soft delete en datos de negocio

Estándar SpaceDev. Clientes, suscripciones, pagos, reservas y asistencias usan
`deletedAt` en lugar de borrado físico, porque el historial que centraliza la base es
el activo del negocio.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Historial perdido por borrado fisico]]
