---
type: system
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/api/src/modules/settings/settings.module.ts
  - move/apps/api/src/modules/settings/services/settings.service.ts
  - move/apps/api/src/modules/settings/settings.defaults.ts
  - move/apps/api/src/modules/settings/controllers/settings.controller.ts
  - move/apps/web/src/components/staff/config/rules-tab.tsx
  - move/apps/web/src/components/staff/config/contact-tab.tsx
---
# Modulo configuracion

Valores operativos guardados en la tabla `settings` y editables por el staff: límite
de cancelación, ventana de reserva, vencimiento de retenciones, conciliación,
umbrales de seguimiento y check-in mensual. Arranca con valores provisorios y la web
lo avisa mientras `values_provisional` siga activo. Desde la tanda de comentarios
también guarda los datos de contacto y el email de avisos al staff como texto, en un
tipo aparte (`ContactInfo`), con `GET /settings/contact` público y
`GET/PATCH /staff/settings/contact`.

## Structural
- is part of → [[API NestJS]]
