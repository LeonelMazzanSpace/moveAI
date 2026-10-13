---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/apps/api/src/modules/clients/domain/client-status.ts
---
# Estado del cliente

Clasificación que ve el staff: activo, por vencer, vencido, inactivo o en pausa con
motivo. Se calcula con vigencia, renovaciones programadas, actividad y pausas; no se
carga a mano.

## Structural
- depends on → [[Suscripcion]]
- depends on → [[Metricas de actividad]]
- depends on → [[Motivo de inactividad]]
