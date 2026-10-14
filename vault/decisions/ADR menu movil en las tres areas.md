---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/components/layout/mobile-nav.tsx
  - move/apps/web/src/components/layout/staff-mobile-nav.tsx
---
# ADR menu movil en las tres areas

D71, decidida por el usuario: el sitio público, el área de cliente y el panel de staff
tienen menú móvil (los mockups no lo traían). Tablas de staff que desbordaban pasaron
a tarjetas en mobile (D82, hallazgo de la revisión visual del manual).

## Structural
- establishes → [[Pantallas sin scroll horizontal en mobile]]
- constrains → [[Panel staff web]]
- constrains → [[Area publica web]]
- constrains → [[Area cliente web]]
- enables → [[Menu movil se reabre al volver a la pagina]]
