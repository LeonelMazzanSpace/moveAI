---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/jobs/expire-holds.job.ts
  - move/apps/api/src/modules/settings/settings.defaults.ts
---
# Reserva pendiente de pago expira

Una retención de reserva paga que no recibe pago aprobado vence a los
`pending_payment_minutes` (15 provisorio) y libera la franja; su compra pendiente
también expira. Un job la revisa cada minuto. Confirmada por el equipo (D11).

## Structural
- constrains → [[Reserva]]
- prevents → [[Horario retenido por pago abandonado]]
