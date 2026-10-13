---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# Datos personales expuestos en logs

Emails, tokens o respuestas de salud de check-ins aparecen en los logs de Elastic
Beanstalk. Defensa activa: logs solo con IDs y el logger de Better Auth sin
argumentos crudos.
