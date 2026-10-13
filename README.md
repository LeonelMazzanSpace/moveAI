# MOVE

Monorepo (pnpm workspaces) de la plataforma MOVE — Performance, Rehab & Recovery.

| App | Path | Stack | Puerto local |
|---|---|---|---|
| Web | `apps/web` | Next.js (App Router) · TypeScript · Tailwind v4 · shadcn/ui | 3000 |
| API | `apps/api` | NestJS · TypeORM · PostgreSQL · class-validator / class-transformer | 3001 (`/api`) |
| DB | `docker-compose.yml` | PostgreSQL 17 (Docker, solo desarrollo) | 5432 |

## Requisitos

- Node 24 (`nvm use`)
- pnpm 10
- Docker

## Setup local

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up          # levanta Postgres en Docker
pnpm dev            # web + api en paralelo
```

## Scripts raíz

| Script | Qué hace |
|---|---|
| `pnpm dev` | Web y API en modo watch |
| `pnpm dev:web` / `pnpm dev:api` | Una sola app |
| `pnpm build` / `pnpm lint` / `pnpm test` | Corre el script en todas las apps |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Postgres local |

## Migraciones (API)

`synchronize` está desactivado: todo cambio de esquema va por migración. Los comandos compilan primero y usan `dist/database/data-source.js`.

```bash
pnpm --filter @move/api migration:generate src/database/migrations/<Nombre>
pnpm --filter @move/api migration:run
pnpm --filter @move/api migration:revert
pnpm --filter @move/api migration:show
```

Las tablas y columnas se nombran en snake_case automáticamente (`SnakeNamingStrategy`).
