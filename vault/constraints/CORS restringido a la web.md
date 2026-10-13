---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/main.ts
  - move/apps/api/src/config/app.config.ts
---
# CORS restringido a la web

La API acepta CORS con credenciales solo desde `WEB_URL`. Verificado el 2026-10-13:
el preflight devolvió `http://localhost:3000`.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Llamadas desde origenes no autorizados]]
