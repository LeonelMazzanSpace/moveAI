---
type: constraint
status: proposed
semana: 3
updated: 2026-10-13
source:
  - move/MOVE.pdf#p5
  - move/MOVE.pdf#p11
  - move/imagenes/htmls/06-recovery.html
  - move/imagenes/finales/06-recovery.png
---
# Sesiones Recovery no exceden el paquete

Una reserva asociada a un paquete Recovery descuenta una sesión del período en
curso y se rechaza si no quedan. Falta definir si las sesiones no usadas vencen a fin
de mes.

## Structural
- constrains → [[Paquete de sesiones Recovery]]
- prevents → [[Paquete Recovery sobreconsumido]]
