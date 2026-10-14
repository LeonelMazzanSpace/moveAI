---
type: system
status: shipped
semana: 3
updated: 2026-10-14
source:
  - move/apps/api/src/modules/notifications/notifications.module.ts
  - move/apps/api/src/modules/notifications/services/notifications.service.ts
  - move/apps/api/src/modules/notifications/templates/index.ts
  - move/apps/api/src/modules/notifications/templates/layout.ts
  - move/apps/api/src/modules/notifications/entities/email-log.entity.ts
---
# Modulo notificaciones

Envío de emails transaccionales y automáticos con plantillas propias, detrás de un
service que es el único que conoce a Brevo. Cada envío deja antes una fila en
`email_logs` con clave única, y los emails salen después del commit de la operación.
Desde la tanda de comentarios son 17 plantillas con pie de contacto leído de
`settings` al enviar (si no se puede leer, sale sin pie), y `sendToStaff` manda a la
dirección de avisos del staff con la misma clave de idempotencia.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Brevo]]
- depends on → [[Modulo configuracion]] because lee los datos de contacto y el email de avisos al staff
