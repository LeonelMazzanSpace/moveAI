---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
---
# ADR modulos simples por dominio

Decisión del equipo del 2026-10-13: módulos Nest simples, uno por dominio, en
`src/modules/<modulo>/` con controller → service → repositorio TypeORM, sin puertos ni
adaptadores. Si un módulo tiene varias piezas, se agrupan por tipo (`controllers/`,
`services/`, `entities/`, `models/`, `dto/`). Prioriza la velocidad del MVP de 4
semanas; si la lógica crece, refactorizar después cuesta más.

## Structural
- supersedes → [[ADR arquitectura hexagonal por modulo]]
- establishes → [[Entidades ORM no salen del servicio]]
- establishes → [[Integraciones externas encapsuladas en un servicio]]
- establishes → [[Dependencias entre modulos aciclicas]]
- constrains → [[API NestJS]]
