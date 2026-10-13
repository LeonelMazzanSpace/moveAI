---
type: constraint
status: proposed
semana: 4
updated: 2026-10-13
source:
  - move/MOVE.pdf#p7
  - move/imagenes/htmls/09-seguimiento-retencion.html
  - move/imagenes/finales/09-seguimiento-retencion.png
---
# Clientes en pausa excluidos de alertas

Un cliente con motivo de inactividad vigente (por ejemplo, pausa por lesión con
re-contacto el 01/11) no dispara alertas de inactividad. Solo dispara la alerta de
re-contacto en la fecha pedida. Lo mismo vale para los emails automáticos al
cliente.

## Structural
- constrains → [[Alerta de seguimiento]]
- constrains → [[Modulo automatizaciones]]
- prevents → [[Alertas de inactividad falsas]]
- prevents → [[Email automatico indebido al cliente]]
