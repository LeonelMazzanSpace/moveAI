---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/package.json
  - move/apps/web/src/lib/api/client.ts
  - move/apps/web/src/lib/api/server.ts
  - move/apps/web/src/app/providers.tsx
---
# ADR capa de datos del frontend

Adoptada con un desvío del estándar SpaceDev (D18): un wrapper propio sobre `fetch`
(`apiFetch` y `serverApiFetch`) en lugar de Axios con interceptores, porque funciona
igual en Server Components y en el cliente. TanStack Query para estado de servidor en
componentes cliente, React Hook Form + Zod para formularios y sin Redux.

## Structural
- establishes → [[Formularios validados con Zod]]
- constrains → [[App web Next]]
