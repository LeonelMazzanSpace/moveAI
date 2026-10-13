---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/apps/api/src/modules/followup/domain/alert-rules.ts
  - move/apps/api/test/alerts.e2e-spec.ts
---
# Alertas de inactividad falsas

El staff recibe alertas de "una semana sin asistir" de clientes que sí vinieron o
que están en pausa por lesión. Erosiona la confianza en la bandeja de seguimiento.
Defensa activa: las reglas leen asistencias reales y excluyen pausas.
