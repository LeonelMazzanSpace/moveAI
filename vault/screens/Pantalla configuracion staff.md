---
type: screen
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/web/src/app/staff/configuracion/page.tsx
  - move/apps/web/src/components/staff/config/configuration-tabs.tsx
  - move/apps/web/src/components/staff/config/plans-tab.tsx
  - move/apps/web/src/components/staff/config/schedule-tab.tsx
  - move/apps/web/src/components/staff/config/contact-tab.tsx
  - move/apps/web/src/components/staff/config/calendar-tab.tsx
---
# Pantalla configuracion staff

Configuración del panel, sin mockup (D12): pestañas de planes, horarios, profesionales,
reglas, contacto y calendario (`?tab=`), con el aviso de valores provisorios mientras
MOVE no los confirme. El formulario de planes suma "Permite débito automático".
Calendario muestra los estados no configurado, desconectado, sin calendario elegido,
conectado y requiere reconexión, y lee `?calendar=connected|error` al volver de Google.

## Structural
- is part of → [[Panel staff web]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo configuracion]]
- depends on → [[Google Calendar]]
