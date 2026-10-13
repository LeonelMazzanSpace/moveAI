---
type: concept
status: proposed
updated: 2026-10-13
source:
  - move/imagenes/htmls/03-performance.html
  - move/imagenes/finales/03-performance.png
---
# Reservas concurrentes al ultimo cupo

Mecanismo: dos o más clientes intentan reservar a la vez el último lugar de un
turno (19:00 con 13/14 en el mockup). Si leer el cupo y escribir la reserva no es
atómico, ambas reservas pasan.

## Structural
- causes → [[Sobreventa de cupos]]
