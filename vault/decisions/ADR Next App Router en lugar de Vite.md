---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/apps/web/package.json
---
# ADR Next App Router en lugar de Vite

El frontend es Next.js App Router y no React + Vite (default de SpaceDev): la
propuesta lo pide por SEO en lo público y para tener público, cliente y staff en una
sola app desplegada en Vercel.

## Structural
- constrains → [[App web Next]]
- establishes → [[Paginas publicas renderizadas en servidor]]
