---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/apps/api/src/modules/followup/domain/alert-rules.ts
  - move/apps/api/src/modules/settings/settings.defaults.ts
---
# Regla de automatizacion

Regla que un job evalúa con umbrales guardados en PostgreSQL: plan por vencer,
vencido sin renovar, una semana sin asistir, inactividad prolongada, baja de
frecuencia y re-contacto pedido.

## Structural
- is part of → [[Modulo automatizaciones]]
- mitigates → [[Cliente vencido sin seguimiento]] because detecta por vencer y vencidos sin renovar
