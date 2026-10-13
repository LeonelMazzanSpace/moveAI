---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/globals.css
  - move/apps/web/src/components/move/status-badge.tsx
---
# Estilos via tokens del tema

Los colores y tipografías del sistema visual son variables CSS del tema en
`globals.css` (fondos, card, bordes, texto atenuado y tonos de estado) y los
componentes los usan por token. No se hardcodean hex en componentes. Adoptada como
regla global del plan.

## Structural
- constrains → [[App web Next]]
- prevents → [[UI inconsistente con el diseno]]
