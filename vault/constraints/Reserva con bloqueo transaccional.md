---
type: constraint
status: proposed
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
---
# Reserva con bloqueo transaccional

Contar el cupo e insertar la reserva van en una sola transacción, con bloqueo de
fila del horario (`SELECT … FOR UPDATE`) o un contador con restricción `CHECK`. La
validación de plan vigente va dentro de esa misma transacción. Sin esto, el cupo
máximo es solo una intención.

## Structural
- constrains → [[Modulo reservas]]
- prevents → [[Sobreventa de cupos]]
