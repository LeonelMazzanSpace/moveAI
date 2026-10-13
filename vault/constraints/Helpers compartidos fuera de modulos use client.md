---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/web/src/app/server-client-boundary.test.ts
  - move/apps/web/src/lib/pagination.ts
---
# Helpers compartidos fuera de modulos use client

Una función o constante que usa una página Server Component vive en un módulo sin
`'use client'` (por ejemplo `lib/`). Un test de frontera recorre las páginas y layouts
de servidor y falla si importan algo que no sea un componente desde un módulo cliente.

## Structural
- constrains → [[App web Next]]
- prevents → [[Helper de modulo use client rompe un Server Component]]
