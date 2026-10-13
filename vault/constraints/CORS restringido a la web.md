---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/app.setup.ts
  - move/apps/api/src/config/app.config.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# CORS restringido a la web

La API acepta CORS con credenciales solo desde `WEB_URL`, y Better Auth confía solo
en ese origen. Por eso una preview de Vercel con URL automática no puede usar la API
de dev desde el navegador.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Llamadas desde origenes no autorizados]]
