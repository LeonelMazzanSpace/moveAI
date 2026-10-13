---
type: failure
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
  - move/apps/api/src/config/auth.config.ts
---
# Sesion no viaja entre web y API

La cookie de sesión emitida en un dominio no se envía al otro (por ejemplo
`*.vercel.app` y `*.elasticbeanstalk.com`) y todas las llamadas autenticadas fallan
en producción, aunque en local funcionen. El código soporta `COOKIE_DOMAIN`, pero sin
dominio ni deploy la defensa no está aplicada.
