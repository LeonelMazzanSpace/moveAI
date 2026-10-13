---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p7
  - move/apps/api/src/modules/automations/domain/expiry-reminders.ts
---
# Email automatico indebido al cliente

Un job le manda a un cliente un email que no corresponde, por ejemplo "una semana
sin asistir" a alguien en pausa por lesión, o "tu plan vence" a quien ya renovó.
Defensa activa: pausas y renovaciones programadas excluidas de los avisos.
