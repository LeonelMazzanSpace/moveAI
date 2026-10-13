---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# ADR Better Auth con Google OAuth

La autenticación usa Better Auth sobre PostgreSQL más el Google OAuth de MOVE, sin un
IdP pago. Pisa el default de SpaceDev (Clerk para MVPs) porque la propuesta prioriza
no tener costos recurrentes. Google queda apagado hasta tener credenciales.

## Structural
- constrains → [[Better Auth]]
- establishes → [[Roles persistidos cliente y staff]]
- establishes → [[Autorizacion validada en la API]]
- establishes → [[Una cuenta por email]]

## Associative
- opens a question about → [[ADR ubicacion de Better Auth]]
