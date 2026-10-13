---
type: constraint
status: todo
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p17
  - move/imagenes/htmls/03-performance.html
  - move/imagenes/finales/03-performance.png
---
# Reserva Performance requiere plan vigente

Solo se reserva un horario de Performance con una suscripción vigente a la fecha
del turno. Con el plan vencido se bloquean las reservas nuevas y se lleva al usuario a
renovar; se valida en la API, no en el front.

## Structural
- constrains → [[Reserva]]
- requires → [[Suscripcion]] because la vigencia se evalúa a la fecha del turno
- enables → [[Renovacion de plan]] because el bloqueo deriva al usuario a renovar
- prevents → [[Reserva con plan vencido]]
