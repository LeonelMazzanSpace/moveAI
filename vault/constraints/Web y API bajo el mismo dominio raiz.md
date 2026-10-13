---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
  - move/apps/api/src/config/auth.config.ts
  - move/docs/deploy.md
---
# Web y API bajo el mismo dominio raiz

Con Better Auth en la API, web y API se publican bajo el mismo dominio raíz (por
ejemplo `<dominio>` y `api.<dominio>`) con `COOKIE_DOMAIN` para que la cookie de
sesión llegue a ambas. El código ya lo soporta; falta el dominio final y el deploy.

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- prevents → [[Sesion no viaja entre web y API]]
