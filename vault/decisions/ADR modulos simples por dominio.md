---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/bookings/bookings.module.ts
---
# ADR modulos simples por dominio

Decisión del equipo del 2026-10-13: módulos Nest simples, uno por dominio, en
`src/modules/<modulo>/` con controller → service → repositorio TypeORM, sin puertos ni
adaptadores, agrupados por tipo (`controllers/`, `services/`, `entities/`, `models/`,
`dto/`, `domain/` para funciones puras). Aplicada en los doce módulos del MVP.

## Structural
- supersedes → [[ADR arquitectura hexagonal por modulo]]
- establishes → [[Entidades ORM no salen del servicio]]
- establishes → [[Integraciones externas encapsuladas en un servicio]]
- establishes → [[Dependencias entre modulos aciclicas]]
- constrains → [[API NestJS]]
