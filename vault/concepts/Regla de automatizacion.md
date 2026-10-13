---
type: concept
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/MOVE.pdf#p7
  - move/MOVE.pdf#p12
---
# Regla de automatizacion

Regla guardada en PostgreSQL que un job evalúa: plan próximo a vencer, vencido
sin renovar, una semana sin asistir, inactividad prolongada, baja de frecuencia,
re-contacto pedido y seguimiento periódico pendiente.

## Structural
- is part of → [[Modulo automatizaciones]]
- mitigates → [[Cliente vencido sin seguimiento]] because detecta por vencer y vencidos sin renovar
