---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/users/users.module.ts
  - move/apps/api/src/modules/users/entities/user.entity.ts
  - move/apps/api/src/modules/users/controllers/me.controller.ts
  - move/apps/api/src/cli/create-staff.ts
---
# Modulo usuarios

Usuarios y perfiles: datos personales, rol, habilitación de seguimiento
fisioterapéutico y soft delete. La tabla `users` es la misma que usa Better Auth. Las
cuentas staff se crean por CLI (`user:create-staff`), no desde la web.

## Structural
- is part of → [[API NestJS]]
