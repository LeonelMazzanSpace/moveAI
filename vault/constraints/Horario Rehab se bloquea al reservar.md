---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/schedule/domain/slot-generation.ts
---
# Horario Rehab se bloquea al reservar

Un turno de Rehab es la franja de un profesional con cupo 1, así que al tomarlo (aun
como retención pendiente de pago) queda bloqueado para otros con la misma
transacción y bloqueo que el resto de las reservas.

## Structural
- constrains → [[Disponibilidad profesional]]
- prevents → [[Doble reserva del mismo horario Rehab]]

## Associative
- resembles → [[Cupo maximo por horario]]
