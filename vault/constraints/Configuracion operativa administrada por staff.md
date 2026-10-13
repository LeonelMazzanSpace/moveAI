---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/web/src/app/staff/configuracion/page.tsx
  - move/apps/api/src/modules/settings/services/settings.service.ts
  - move/apps/api/src/modules/catalog/controllers/staff-plans.controller.ts
  - move/apps/api/src/modules/schedule/controllers/staff-templates.controller.ts
---
# Configuracion operativa administrada por staff

Planes, horarios, cupos, profesionales, límite de cancelación y umbrales de
automatización se administran desde Configuración, con rangos de validación iguales
en web y API (D38). Nada de eso va hardcodeado; los valores iniciales son provisorios.

## Structural
- constrains → [[Modulo catalogo]]
- constrains → [[Modulo agenda]]
- constrains → [[Modulo configuracion]]
- constrains → [[Regla de automatizacion]]
