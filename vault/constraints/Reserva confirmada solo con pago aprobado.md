---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/payments/services/payments.service.ts
---
# Reserva confirmada solo con pago aprobado

En la evaluación de Rehab y la sesión individual de Recovery la reserva nace como
retención `pending_payment` y se confirma, con su email, solo cuando la API aplica el
pago aprobado. Una reserva Recovery con paquete no lleva pago propio: consume una
sesión.

## Structural
- constrains → [[Reserva]]
- prevents → [[Reserva confirmada sin pago]]
