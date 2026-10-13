---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/web/src/app/staff/layout.tsx
  - move/apps/web/src/components/layout/staff-sidebar.tsx
---
# Panel staff web

Rutas `/staff` con sidebar: Dashboard, Clientes (lista, alta y detalle), Turnos y
asistencia, Pagos, Seguimiento (bandeja y check-ins) y Configuración. El layout exige
rol staff; un cliente nunca llega a estas rutas.

## Structural
- is part of → [[App web Next]]
- depends on → [[Modulo auth]]
