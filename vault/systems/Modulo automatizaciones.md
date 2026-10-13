---
type: system
status: todo
semana: 4
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
  - move/MOVE.pdf#p18
---
# Modulo automatizaciones

Jobs programados que recorren las reglas guardadas en PostgreSQL (vencimientos,
inactividad, re-contactos, check-ins pendientes) y generan alertas y emails. No
tiene lógica de negocio propia: delega en seguimiento y notificaciones.

## Structural
- is part of → [[API NestJS]]
- depends on → [[NestJS Scheduler]]
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo notificaciones]]
