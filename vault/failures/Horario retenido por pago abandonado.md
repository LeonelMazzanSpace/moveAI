---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p5
  - move/apps/api/src/modules/bookings/jobs/expire-holds.job.ts
---
# Horario retenido por pago abandonado

Alguien elige un horario de Rehab o Recovery, abandona el pago y la franja queda
bloqueada indefinidamente. Defensa activa: la retención vence a los minutos
configurados.
