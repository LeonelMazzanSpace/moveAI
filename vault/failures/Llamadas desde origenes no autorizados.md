---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.setup.ts
---
# Llamadas desde origenes no autorizados

Un sitio ajeno hace llamadas con credenciales a la API. Defensa activa: CORS
restringido a `WEB_URL` y Better Auth con un único origen de confianza.
