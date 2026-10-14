---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/playwright.config.ts
  - move/scripts/e2e/reset.mjs
  - move/scripts/e2e/env.mjs
  - move/docs/development.md
---
# ADR suite E2E desktop y mobile

D73, pedida por el usuario: vuelve Playwright Test con una suite que recorre los flujos
principales de visitante, cliente y staff en dos proyectos, desktop (1440 px) y mobile
(perfil iPhone 15 en Chromium), sobre una base `move_e2e` propia y puertos 3150/3250.
En mobile cada pantalla visitada se mide para que no tenga scroll horizontal. No corre
en Bitbucket Pipelines.

## Structural
- supersedes → [[ADR sin E2E web de demos]]
- establishes → [[Suite E2E solo sobre su base propia]]
- establishes → [[Pantallas sin scroll horizontal en mobile]]
- constrains → [[Suite E2E Playwright]]
