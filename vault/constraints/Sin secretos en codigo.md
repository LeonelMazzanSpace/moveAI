---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/.gitignore
  - move/apps/api/.env.example
---
# Sin secretos en codigo

Credenciales, tokens y claves solo por variables de entorno: `.env` locales
gitignored, Vercel y Elastic Beanstalk en producción. Los `.env.example` solo tienen
valores de desarrollo.

## Structural
- constrains → [[API NestJS]]
- constrains → [[App web Next]]
- prevents → [[Secretos filtrados]]
