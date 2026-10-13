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
`apps/web` y `apps/api`, un `docker-compose.yml` con Postgres para desarrollo, los
scripts del manual y el empaquetado de la API para Elastic Beanstalk. Los scripts
raíz orquestan ambas apps.
