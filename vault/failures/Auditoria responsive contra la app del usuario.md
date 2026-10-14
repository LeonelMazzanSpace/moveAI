---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/scripts/responsive/audit.mjs
---
# Auditoria responsive contra la app del usuario

La primera versión de `pnpm responsive:audit` tenía por defecto `localhost:3000` y
`localhost:3001/api`, y su guardia "solo local" dejaba pasar esos puertos. Olvidar las
variables hacía que el script iniciara sesión y recorriera la app que el usuario corre
en local, creando sesiones en su base (review T-065, I-1).
