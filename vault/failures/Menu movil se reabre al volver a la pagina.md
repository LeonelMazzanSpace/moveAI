---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/src/components/layout/mobile-nav.tsx
  - move/apps/web/src/components/layout/mobile-nav.test.tsx
---
# Menu movil se reabre al volver a la pagina

El menú guardaba "abierto en esta ruta" y lo comparaba con la ruta actual: con Atrás y
Adelante volvía a abrirse solo, como diálogo modal que atrapa el foco (review de T-049,
I-1). Fix: estado `open` explícito que se cierra al cambiar la ruta, con test de ida y
vuelta.
