---
type: system
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/followup/followup.module.ts
  - move/apps/api/src/modules/followup/services/alerts.service.ts
  - move/apps/api/src/modules/followup/services/contacts.service.ts
  - move/apps/api/src/modules/followup/services/inactivity.service.ts
  - move/apps/api/src/modules/followup/services/checkins.service.ts
---
# Modulo seguimiento

Módulo de retención (`modules/followup`): alertas, contactos del staff, pausas con
motivo y fecha de re-contacto, y check-ins con sus respuestas. Lee asistencia y
vigencia para detectar situaciones; los umbrales vienen de la configuración.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo reservas]]
- depends on → [[Modulo suscripciones]]
- depends on → [[Modulo configuracion]] because umbrales de detección
