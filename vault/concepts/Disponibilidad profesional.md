---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/schedule/entities/professional.entity.ts
  - move/apps/api/src/modules/schedule/entities/time-slot.entity.ts
---
# Disponibilidad profesional

Turnos en que un profesional de Rehab atiende: cada uno admite una sola consulta y
se bloquea al reservarlo. La administra el staff con plantillas o turnos sueltos.

## Structural
- is a case of → [[Horario]]
- depends on → [[Servicio Rehab]]
