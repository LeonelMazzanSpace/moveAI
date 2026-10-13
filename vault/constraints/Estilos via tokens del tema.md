---
type: constraint
status: proposed
semana: 1
updated: 2026-10-13
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/globals.css
---
# Estilos via tokens del tema

Los colores y tipografías del sistema visual se definen como variables CSS de
shadcn en `globals.css` (`--background`, `--card`, `--border`, `--muted-foreground`)
y se usan por token. No se hardcodean hex en componentes.

## Structural
- constrains → [[App web Next]]
- prevents → [[UI inconsistente con el diseno]]
