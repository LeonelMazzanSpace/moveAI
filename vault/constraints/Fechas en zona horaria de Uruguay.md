---
type: constraint
status: proposed
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p3
  - move/imagenes/htmls/01-sitio-publico.html
  - move/imagenes/finales/01-sitio-publico.png
---
# Fechas en zona horaria de Uruguay

Turnos, vencimientos y cron se calculan en `America/Montevideo` y se guardan como
`timestamptz`. "Vence el 15/11" significa el fin de ese día en Uruguay, no en
UTC.

## Structural
- constrains → [[Suscripcion]]
- constrains → [[Horario]]
- constrains → [[Modulo automatizaciones]]
- prevents → [[Fechas corridas por zona horaria]]
