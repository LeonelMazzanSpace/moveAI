---
type: system
status: built-off-by-default
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/notifications/services/brevo.service.ts
  - move/apps/api/src/modules/notifications/services/notifications.service.ts
  - move/apps/api/src/config/brevo.config.ts
---
# Brevo

Proveedor de email de MOVE, integrado por API REST desde un único service. Sin
`BREVO_API_KEY` el módulo de notificaciones corre en modo dry-run: no envía y deja el
registro en `email_logs`. En producción la API exige clave y remitente.
