---
type: system
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/notifications/notifications.module.ts
  - move/apps/api/src/modules/notifications/services/notifications.service.ts
  - move/apps/api/src/modules/notifications/templates/index.ts
  - move/apps/api/src/modules/notifications/entities/email-log.entity.ts
---
# Modulo notificaciones

Envío de emails transaccionales y automáticos con plantillas propias, detrás de un
service que es el único que conoce a Brevo. Cada envío deja antes una fila en
`email_logs` con clave única, y los emails salen después del commit de la operación.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Brevo]]
