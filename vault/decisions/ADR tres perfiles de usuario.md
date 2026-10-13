---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p3
  - move/apps/api/src/modules/users/entities/user.entity.ts
---
# ADR tres perfiles de usuario

La plataforma tiene exactamente tres perfiles: Visitante, Cliente y Staff MOVE, sin
un esquema de roles más complejo. Visitante puede operar sin cuenta. Solo los clientes
reservan; el staff cancela y marca asistencia pero no reserva por otros (D25).

## Structural
- establishes → [[Roles persistidos cliente y staff]]
- establishes → [[Cuenta se crea durante la reserva]]
