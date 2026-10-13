---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/package.json
  - move/pnpm-workspace.yaml
---
# ADR monorepo pnpm sin Turborepo

Web y API viven en un monorepo con pnpm workspaces y scripts raíz con `--filter`,
sin Turborepo: dos apps no justifican otra herramienta. Facilita un contrato front-back
compartido.

## Structural
- constrains → [[Monorepo MOVE]]
- enables → [[Contrato front-back definido antes de implementar]]
