---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
---
# ADR Better Auth con Google OAuth

La autenticación usa Better Auth sobre PostgreSQL más el Google OAuth existente, sin
un IdP pago. Esto pisa el default de SpaceDev (Clerk para MVPs) porque la propuesta
prioriza no tener costos recurrentes.

## Structural
- constrains → [[Better Auth]]
- establishes → [[Roles persistidos cliente y staff]]
- establishes → [[Autorizacion validada en la API]]
- establishes → [[Una cuenta por email]]

## Associative
- opens a question about → [[ADR ubicacion de Better Auth]]
