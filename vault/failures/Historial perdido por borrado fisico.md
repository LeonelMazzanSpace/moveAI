---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/apps/api/src/modules/users/entities/user.entity.ts
---
# Historial perdido por borrado fisico

Se borra un cliente, pago o reserva y desaparece su historial y las métricas que
dependían de él. Defensa activa: soft delete en los datos de negocio.
