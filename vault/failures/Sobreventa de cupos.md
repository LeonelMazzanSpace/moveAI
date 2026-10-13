---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/test/bookings.e2e-spec.ts
---
# Sobreventa de cupos

Un turno termina con más reservas que su cupo (15/14). Aparece con carga real,
cuando dos clientes reservan el último lugar a la vez. Defensa activa: bloqueo del
turno al reservar, cubierto por un e2e de reservas concurrentes.
