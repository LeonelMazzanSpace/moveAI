---
type: decision
status: draft
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p10
  - move/MOVE.pdf#p14
---
# ADR ubicacion de Better Auth

Sin decidir: Better Auth puede montarse en Next (route handlers) o en la API Nest.
Montarlo en Nest deja auth junto al dominio; montarlo en Next es su integración nativa,
pero la API igual tiene que validar la sesión. En ambos casos, web y API necesitan el
mismo dominio raíz. Decidir antes de empezar el módulo auth.

## Structural
- establishes → [[Web y API bajo el mismo dominio raiz]]
- constrains → [[Modulo auth]]
