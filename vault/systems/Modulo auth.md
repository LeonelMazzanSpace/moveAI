---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/auth/auth.module.ts
  - move/apps/api/src/modules/auth/mount-auth.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
  - move/apps/api/src/modules/auth/guards/auth.guard.ts
---
# Modulo auth

Integra Better Auth dentro de la API Nest bajo `/api/auth/*` y aplica un guard global
que valida la sesión y el rol de cada endpoint (`@Public`, `@Roles`). No exige
verificar el email para ingresar; Google se suma solo si hay credenciales.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Better Auth]]
- depends on → [[Google OAuth]]
- depends on → [[Modulo usuarios]]
