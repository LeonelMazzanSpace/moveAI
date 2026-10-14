---
type: system
status: built-off-by-default
updated: 2026-10-14
source:
  - move/apps/api/src/modules/calendar/calendar.module.ts
  - move/apps/api/src/modules/calendar/services/google-calendar.service.ts
  - move/apps/api/src/modules/calendar/services/calendar-sync.service.ts
  - move/apps/api/src/modules/calendar/services/calendar-connection.service.ts
  - move/apps/api/src/config/calendar.config.ts
  - move/apps/web/src/components/staff/config/calendar-tab.tsx
---
# Google Calendar

Módulo `calendar` de la API, último en el orden de módulos y sin nadie que lo importe.
Un solo service habla con Google por REST (`fetch`, 10 s); el refresh token se guarda
cifrado con AES-256-GCM y `CALENDAR_TOKEN_KEY`. Dos jobs: `calendar-push` cada minuto
(reservas de Rehab confirmadas → eventos) y `calendar-pull` cada 5 minutos (ocupados de
Google → `time_slots.calendar_blocked_at`). Integrado pero apagado sin
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `CALENDAR_TOKEN_KEY`: la pestaña muestra
"no configurado". Solo probado con un Google falso en los e2e.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo agenda]] because escribe la marca de bloqueo de los turnos
- depends on → [[Modulo reservas]] because lee las reservas de Rehab confirmadas
- depends on → [[Modulo notificaciones]] because avisa al staff de conflictos y desconexiones
- depends on → [[Modulo configuracion]] because la ventana de reserva fija el rango que lee
