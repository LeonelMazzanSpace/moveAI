---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p3
  - move/apps/api/src/common/time/business-time.ts
---
# Fechas corridas por zona horaria

Un turno o un vencimiento se muestran o evalúan un día o unas horas corridos porque
se calculan en UTC (Uruguay es UTC−3). Defensa activa: helpers de fecha de negocio en
`America/Montevideo` en API y web.

## Structural
- causes → [[Reserva con plan vencido]]
