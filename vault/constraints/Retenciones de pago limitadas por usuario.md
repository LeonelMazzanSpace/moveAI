---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/test/hold-limits.e2e-spec.ts
---
# Retenciones de pago limitadas por usuario

Un usuario tiene como máximo 2 reservas pendientes de pago vigentes; la tercera
responde 409 `HOLD_LIMIT_REACHED` hasta que pague o venzan. Un invitado que cambia de
email esquiva este límite, por eso se combina con el límite por IP.

## Structural
- constrains → [[Reserva]]
- mitigates → [[Retenciones masivas de invitados]]
