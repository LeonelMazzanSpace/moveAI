---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
  - move/apps/web/src/components/booking/plan-required-notice.tsx
---
# Reserva Performance requiere plan vigente

Solo se reserva un turno de Performance con una suscripción vigente a la fecha del
turno; si no, la API responde `PLAN_REQUIRED` y la web lleva a renovar. Se valida en
la API, dentro de la transacción de la reserva.

## Structural
- constrains → [[Reserva]]
- requires → [[Suscripcion]] because la vigencia se evalúa a la fecha del turno
- enables → [[Renovacion de plan]] because el bloqueo deriva al usuario a renovar
- prevents → [[Reserva con plan vencido]]
