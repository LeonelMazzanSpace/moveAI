---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/apps/api/src/modules/schedule/agenda.module.ts
  - move/apps/web/src/components/booking/slot-grid.tsx
---
# ADR calendario propio

El calendario es propio de MOVE, sin plataforma externa de reservas: el backend maneja
horarios, disponibilidad, cupos y reservas en una agenda unificada para los tres
servicios (D16). La web dibuja grillas propias como los mockups, sin librería de
calendario (D18), opción que el PDF admite como equivalente.

## Structural
- constrains → [[Modulo agenda]]
- establishes → [[Configuracion operativa administrada por staff]]
- establishes → [[Cupo maximo por horario]]
- establishes → [[Reserva con bloqueo transaccional]]
