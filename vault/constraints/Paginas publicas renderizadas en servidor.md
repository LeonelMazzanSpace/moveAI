---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/web/src/app/(public)/page.tsx
  - move/apps/web/src/app/(public)/performance/page.tsx
  - move/apps/web/src/app/(public)/planes/page.tsx
---
# Paginas publicas renderizadas en servidor

Las páginas públicas (inicio, servicios, planes) son Server Components que exportan
`metadata` para SEO; las áreas privadas usan componentes cliente donde hace falta.

## Structural
- constrains → [[Area publica web]]
- prevents → [[Paginas publicas sin indexar]]
