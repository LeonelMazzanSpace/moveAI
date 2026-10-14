---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
  - move/apps/api/src/modules/bookings/services/slot-stats.service.ts
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/payments/services/checkout.service.ts
  - move/apps/api/test/calendar.e2e-spec.ts
---
# Turno bloqueado por Google no reservable

Un turno de Rehab con `calendar_blocked_at` no aparece en las listas públicas ni se
puede reservar por ninguna ruta (`isBookable`, chequeos bajo lock, checkout) y responde
`SLOT_NOT_BOOKABLE`; un pago tardío sobre ese turno queda para el staff (D111). Una
reserva hecha antes del bloqueo se mantiene y el staff recibe un aviso por reserva en
conflicto (D95, D113). Rige solo con el calendario conectado.

## Structural
- constrains → [[Modulo reservas]]
- mitigates → [[Doble reserva del mismo horario Rehab]]
