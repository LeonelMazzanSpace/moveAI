---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/package.json
  - move/apps/api/tsconfig.json
  - move/apps/api/.oxlintrc.json
---
# ADR NestJS 12 en ESM

La API se generó con NestJS 12 en ESM (`type: module`, `nodenext`), con Vitest y
oxlint en lugar de Jest y ESLint, como trae el generador. `no-explicit-any` se puso en
error.

## Structural
- constrains → [[API NestJS]]
- establishes → [[Imports relativos con extension js]]
