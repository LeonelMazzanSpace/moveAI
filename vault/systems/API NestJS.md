---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/main.ts
  - move/apps/api/src/app.setup.ts
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/package.json
---
# API NestJS

`@move/api`: NestJS 12 en ESM con TypeORM y pg, prefijo global `/api`, puerto por
`PORT` (3001 en local). `app.setup.ts` arma lo transversal: `trust proxy` opcional,
CORS a `WEB_URL`, Better Auth montado antes de los body parsers, `ValidationPipe` y
filtro global de errores. Registra los doce módulos de dominio más el throttler del
checkout. Tests unitarios y e2e con Vitest, lint con oxlint.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[Postgres local Docker]] because base de desarrollo
