---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/auth/better-auth.factory.ts
  - move/apps/api/src/modules/auth/mount-auth.ts
---
# ADR Better Auth endurecido

D40 (usuario) y D41 (orquestador, review de T-005): Google se vincula solo a cuentas
con email verificado, y completar un link de restablecer o de invitación marca el
email como verificado; el reset revoca las sesiones; `/update-user` está deshabilitado
y el registro se valida en un hook; `/api/auth/*` rechaza bodies de más de 64 KB y los
que no traen `content-length`, así que el proxy del deploy tiene que reenviarlo.

## Structural
- constrains → [[Modulo auth]]
- establishes → [[Una cuenta por email]]
