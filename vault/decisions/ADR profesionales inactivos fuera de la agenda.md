---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/schedule/services/templates.service.ts
  - move/apps/api/src/modules/schedule/domain/slot-generation.ts
---
# ADR profesionales inactivos fuera de la agenda

D42, del review de T-010: asignar un profesional inactivo a una plantilla o a un turno
responde 404 `PROFESSIONAL_NOT_FOUND`, igual que uno inexistente, y sus plantillas no
generan turnos nuevos.

## Structural
- constrains → [[Modulo agenda]]
