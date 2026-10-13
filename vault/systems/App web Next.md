---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/web/package.json
  - move/apps/web/components.json
  - move/apps/web/src/app/globals.css
---
# App web Next

`@move/web`: Next.js 16 App Router con `src/`, React 19, Tailwind v4 y shadcn
(preset base-nova sobre `@base-ui/react`). Concentra sitio público, área de cliente y
panel staff en una sola app (puerto 3000). Hoy es solo el scaffold: un `Button` de
shadcn y la página por defecto.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[API NestJS]] because toda la lógica de negocio vive en la API
