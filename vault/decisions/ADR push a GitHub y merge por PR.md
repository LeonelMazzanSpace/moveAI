---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
---
# ADR push a GitHub y merge por PR

D67, decidida por el usuario: al cerrar el run, con todo integrado y verificado, se
agrega el remoto de GitHub y se pushea `feature/move-mvp`; el merge a `main` va por PR,
nunca por push directo. Al 2026-10-13 el repo no tiene remoto.

## Structural
- constrains → [[Monorepo MOVE]]

## Associative
- opens a question about → [[Pipeline CI Bitbucket]]
