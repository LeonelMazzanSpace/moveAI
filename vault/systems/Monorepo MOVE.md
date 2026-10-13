---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/package.json
  - move/pnpm-workspace.yaml
  - move/docker-compose.yml
  - move/.nvmrc
  - move/README.md
---
# Monorepo MOVE

Monorepo pnpm workspaces (`apps/*`) sin Turborepo, Node 24, pnpm 10. Contiene
`apps/web` y `apps/api`, y un `docker-compose.yml` con Postgres para desarrollo. Los
scripts raíz (`pnpm dev`, `build`, `lint`, `test`, `db:up`) orquestan ambas apps;
verificados el 2026-10-13.
