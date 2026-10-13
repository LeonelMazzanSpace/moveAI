---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/web/package.json
  - move/apps/web/src/app/layout.tsx
  - move/apps/web/src/proxy.ts
  - move/apps/web/src/lib/api/client.ts
  - move/apps/web/src/lib/api/server.ts
---
# App web Next

`@move/web`: Next.js 16 App Router con React 19, Tailwind v4 y shadcn base-nova.
Una sola app (puerto 3000) con área pública, área de cliente y panel staff. Llama a
la API solo con `apiFetch` (cliente) y `serverApiFetch` (servidor); `proxy.ts`
reenvía la ruta actual para volver a ella después de ingresar.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[API NestJS]] because toda la lógica de negocio vive en la API
