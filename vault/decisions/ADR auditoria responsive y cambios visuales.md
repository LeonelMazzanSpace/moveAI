---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/docs/responsive-audit.md
  - move/scripts/responsive/audit.mjs
  - move/apps/web/src/components/move/button-styles.ts
---
# ADR auditoria responsive y cambios visuales

D98 y D119: al final de la tanda de comentarios se auditaron todas las rutas a 375,
768, 1024 y 1440 px con `pnpm responsive:audit` y se corrigió lo encontrado. Cambios
visibles que se informan al usuario: los botones MOVE miden al menos 32 px de alto en
todos los anchos, el menú móvil del sitio público y del panel staff se usa hasta
1023 px, y las tablas de turnos y pagos son tarjetas hasta 1279 px.

## Structural
- constrains → [[App web Next]]
- establishes → [[Pantallas sin scroll horizontal en mobile]]
- establishes → [[Auditoria responsive falla ante rutas inesperadas]]
- establishes → [[Scripts nunca contra los puertos 3000 y 3001]]
