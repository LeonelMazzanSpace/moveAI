---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
---
# Sin datos personales en logs

Estándar SpaceDev, más la "protección de información sensible" del PDF. Nunca se
loguean contraseñas, tokens, emails completos ni respuestas de check-in (datos de
salud). Los logs usan IDs.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Datos personales expuestos en logs]]
