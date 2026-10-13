---
type: constraint
status: todo
semana: 3
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/imagenes/htmls/05-rehab.html
  - move/imagenes/finales/05-rehab.png
---
# Horario Rehab se bloquea al reservar

Al elegir horario de Rehab, esa franja del profesional se bloquea automáticamente
para otros. Equivale a un cupo de 1 con la misma exigencia de atomicidad.

## Structural
- constrains → [[Disponibilidad profesional]]
- prevents → [[Doble reserva del mismo horario Rehab]]

## Associative
- resembles → [[Cupo maximo por horario]]
