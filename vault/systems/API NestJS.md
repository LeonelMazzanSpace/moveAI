---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/main.ts
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/package.json
---
# API NestJS

`@move/api`: NestJS 12 en ESM con TypeORM 1.1 y pg, prefijo global `/api`,
puerto 3001. Ya tiene config validada, `ValidationPipe` global, CORS a `WEB_URL` y
conexión a Postgres verificada; no tiene ningún módulo de dominio todavía. Tests con
Vitest, lint con oxlint.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[Postgres local Docker]] because base de desarrollo
