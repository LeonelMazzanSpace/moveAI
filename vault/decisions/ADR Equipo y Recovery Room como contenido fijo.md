---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/apps/web/src/components/public/team-data.ts
  - move/apps/web/src/components/public/recovery-room-data.ts
  - move/apps/web/src/components/public/team-section.tsx
  - move/apps/web/src/components/public/recovery-room-section.tsx
---
# ADR Equipo y Recovery Room como contenido fijo

D90, comentarios del cliente del 2026-10-14: la sección "Equipo" del inicio (`#equipo`)
y "Recovery Room by MOVE" de `/recovery` son contenido fijo en archivos de datos
tipados, con el texto del sitio actual y seis fotos estáticas en `apps/web/public/img/`.
Sin CMS ni subida de archivos: cambiar una bio o una foto es un cambio de código.

## Structural
- constrains → [[Area publica web]]
- constrains → [[Pantalla sitio publico]]
- constrains → [[Pantalla Recovery]]
