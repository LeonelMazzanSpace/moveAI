---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/auth/guards/auth.guard.ts
  - move/apps/api/src/common/auth/roles.decorator.ts
  - move/apps/api/test/auth.e2e-spec.ts
---
# Autorizacion validada en la API

Un guard global exige sesión salvo en rutas `@Public` y verifica el rol de `@Roles`:
`/api/staff/*` responde 403 a un cliente y 401 sin sesión. Las operaciones de cliente
filtran por el dueño del recurso (la reserva ajena responde 404). Ocultar rutas en el
front no protege nada.

## Structural
- constrains → [[Modulo auth]]
- prevents → [[Cliente accede a funciones de staff]]
