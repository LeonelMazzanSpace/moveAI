---
type: decision
status: proposed
updated: 2026-10-13
source:
  - move/apps/web/package.json
---
# ADR capa de datos del frontend

Propuesta según el estándar SpaceDev: React Query para estado de servidor, React
Hook Form + Zod para formularios y un cliente HTTP con interceptores. Redux solo si
aparece estado global real. No hay nada instalado todavía.

## Structural
- establishes → [[Formularios validados con Zod]]
- constrains → [[App web Next]]
