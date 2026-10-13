---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/package.json
---
# ADR sin E2E web de demos

D50, decidida por el usuario: no se hacen los E2E de navegador de las demos
semanales; se quitó Playwright Test y el cierre usa un smoke test local. La web queda
cubierta por tests de componentes y el build, que no ven fallas que solo aparecen al
renderizar una página real.

## Structural
- enables → [[Helper de modulo use client rompe un Server Component]]
