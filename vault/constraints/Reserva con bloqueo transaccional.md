---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/bookings/services/bookings.service.ts
  - move/apps/api/test/bookings.e2e-spec.ts
---
# Reserva con bloqueo transaccional

Contar el cupo e insertar la reserva van en una sola transacción, con `SELECT … FOR
UPDATE` del turno; la validación de plan o paquete va dentro de la misma transacción.
Dos clientes por el último lugar: uno confirma y el otro recibe `SLOT_FULL`.
Confirmada por el equipo (D11).

## Structural
- constrains → [[Modulo reservas]]
- prevents → [[Sobreventa de cupos]]
