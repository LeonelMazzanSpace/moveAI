---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/settings/settings.defaults.ts
  - move/apps/web/src/components/staff/config/rules-tab.tsx
  - move/apps/web/src/components/staff/clientes/client-kpis.tsx
---
# Umbrales de seguimiento

Valores provisorios de cada regla (D10), editables en Configuración: por vencer 7
días, sin asistir 7 días, inactividad prolongada 21 días, y baja de frecuencia cuando
el promedio de las últimas 2 semanas cae por debajo de la mitad del de las 8 previas.
MOVE todavía tiene que confirmarlos. Los KPIs del panel muestran el número configurado,
no un valor fijo (D71).

## Structural
- is part of → [[Regla de automatizacion]]
