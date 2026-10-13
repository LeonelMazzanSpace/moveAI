---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/MOVE.pdf#p11
---
# ADR calendario propio

El calendario es propio de MOVE, sin plataforma externa de reservas. El backend
maneja horarios, disponibilidad, cupos y reservas; el front usa una librería de
calendario (FullCalendar, React Big Calendar o similar, sin elegir).

## Structural
- constrains → [[Modulo agenda]]
- establishes → [[Configuracion operativa administrada por staff]]
- establishes → [[Cupo maximo por horario]]
- establishes → [[Reserva con bloqueo transaccional]]
