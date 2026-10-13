---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/common/time/business-time.ts
  - move/apps/web/src/lib/format.ts
---
# Fechas en zona horaria de Uruguay

Turnos, vencimientos y cron se calculan en `America/Montevideo` con helpers únicos;
las fechas de negocio son `YYYY-MM-DD` y los instantes `timestamptz`. "Vence el 15/11"
permite un turno del 15/11 a las 21:00 locales. La web formatea siempre en esa zona.
Confirmada por el equipo (D11).

## Structural
- constrains → [[Suscripcion]]
- constrains → [[Horario]]
- constrains → [[Modulo automatizaciones]]
- prevents → [[Fechas corridas por zona horaria]]
