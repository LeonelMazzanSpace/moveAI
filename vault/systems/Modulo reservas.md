---
type: system
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p11
---
# Modulo reservas

Módulo de reservas, cancelaciones y asistencia de los tres servicios. Valida plan
vigente y cupo al reservar, y deja al staff marcar presente, ausente o no show por
turno.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo suscripciones]]
- depends on → [[Modulo usuarios]]
- depends on → [[Modulo auth]] because reservar exige sesión o crearla en el flujo
