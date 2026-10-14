---
type: constraint
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/web/src/app/staff/configuracion/page.tsx
  - move/apps/api/src/modules/settings/services/settings.service.ts
  - move/apps/api/src/modules/catalog/controllers/staff-plans.controller.ts
  - move/apps/api/src/modules/schedule/controllers/staff-templates.controller.ts
  - move/apps/api/src/modules/settings/dto/update-contact.dto.ts
---
# Configuracion operativa administrada por staff

Planes, horarios, cupos, profesionales, límite de cancelación y umbrales de
automatización se administran desde Configuración, con rangos de validación iguales
en web y API (D38). Nada de eso va hardcodeado; los valores iniciales son provisorios.
Desde la tanda de comentarios también los datos de contacto y el email de avisos al
staff (claves `contact_*` y `staff_notifications_email`), separados de las reglas
operativas, y la marca "Permite débito automático" de cada plan.

## Structural
- constrains → [[Modulo catalogo]]
- constrains → [[Modulo agenda]]
- constrains → [[Modulo configuracion]]
- constrains → [[Regla de automatizacion]]
