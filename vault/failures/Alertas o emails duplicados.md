---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
  - move/apps/api/src/modules/followup/entities/followup-alert.entity.ts
  - move/apps/api/src/modules/notifications/entities/email-log.entity.ts
---
# Alertas o emails duplicados

El cliente recibe el mismo aviso de vencimiento dos veces, o la bandeja de
seguimiento muestra la misma alerta repetida. Defensa activa: clave única por alerta y
por email, más el lock por job.
