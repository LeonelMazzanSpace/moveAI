---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/docker-compose.yml
---
# Postgres local Docker

Postgres 17-alpine en el contenedor `move-postgres`, puerto 5432, credenciales
por defecto `move/move/move` sobreescribibles por env. Solo para desarrollo: se
levanta con `pnpm db:up` y persiste en el volumen `postgres_data`.

## Structural
- is part of → [[Monorepo MOVE]]
