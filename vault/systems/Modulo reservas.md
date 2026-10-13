---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/bookings.module.ts
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/src/modules/bookings/services/attendance.service.ts
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
  - move/apps/api/src/modules/bookings/jobs/expire-holds.job.ts
---
# Modulo reservas

Reservas, retenciones pendientes de pago, cancelaciones y asistencia de los tres
servicios. Valida plan, paquete o habilitación de seguimiento y cupo dentro de una
transacción con bloqueo del turno; el staff cancela y marca asistencia.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo suscripciones]]
- depends on → [[Modulo usuarios]]
- depends on → [[Modulo auth]] because reservar exige sesión o crearla en el flujo
- depends on → [[Modulo notificaciones]] because emails de confirmación y cancelación
- depends on → [[Modulo configuracion]] because límite de cancelación y vencimiento de retenciones
