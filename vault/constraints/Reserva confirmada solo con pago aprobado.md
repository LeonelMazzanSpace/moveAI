---
type: constraint
status: todo
semana: 3
updated: 2026-10-13
source:
  - move/MOVE.pdf#p5
  - move/MOVE.pdf#p12
  - move/imagenes/htmls/05-rehab.html
  - move/imagenes/finales/05-rehab.png
---
# Reserva confirmada solo con pago aprobado

En la evaluación de Rehab y en la sesión individual de Recovery el orden es
reserva → pago → confirmación: la reserva se confirma, y se manda el email, solo
cuando el backend valida el pago aprobado. Una reserva Recovery asociada a un paquete
no lleva pago propio: consume una sesión.

## Structural
- constrains → [[Reserva]]
- prevents → [[Reserva confirmada sin pago]]
