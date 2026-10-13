---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/apps/api/src/modules/followup/entities/followup-alert.entity.ts
  - move/apps/api/src/modules/followup/domain/alert-rules.ts
---
# Alerta de seguimiento

Situación detectada que pide acción del staff, con tipo, cliente, período y estado
(abierta o gestionada). Es la unidad de trabajo de la bandeja de seguimiento.

## Structural
- depends on → [[Regla de automatizacion]]
- depends on → [[Estado del cliente]]
- is part of → [[Modulo seguimiento]]
