---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p13
---
# ADR Neon como base productiva

Producción usa el Neon existente de MOVE con una base o schema nuevo, sin migrar el
esquema anterior. Se descarta una nueva instancia RDS para el MVP.

## Structural
- constrains → [[Neon Postgres]]
- establishes → [[Conexion SSL a la base en produccion]]
