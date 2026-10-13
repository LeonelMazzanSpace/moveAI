---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/clients/domain/client-status.ts
  - move/apps/api/src/modules/automations/domain/expiry-reminders.ts
---
# ADR renovacion programada no cuenta como por vencer

D49, del review de T-021: un cliente cuyo plan está por vencer pero que ya tiene una
renovación programada no figura "por vencer" en su estado ni en el KPI, y no recibe el
aviso de vencimiento.

## Structural
- constrains → [[Estado del cliente]]
- constrains → [[Modulo automatizaciones]]
