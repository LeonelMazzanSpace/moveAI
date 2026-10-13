---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/common/scheduling/job-runner.service.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
  - move/apps/api/src/common/errors/all-exceptions.filter.ts
---
# Sin datos personales en logs

Estándar SpaceDev, más la protección de información sensible del PDF. Los logs llevan
solo IDs y nombres de job o de plantilla; nunca emails, teléfonos, tokens, contraseñas
ni respuestas de check-in. Better Auth reenvía al log solo el mensaje, no sus
argumentos crudos.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Datos personales expuestos en logs]]
