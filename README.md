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
pnpm db:up                                   # levanta Postgres en Docker
pnpm --filter @move/api migration:run        # crea el esquema
pnpm --filter @move/api seed                 # planes, horarios y configuración provisorios
pnpm dev                                     # web + api en paralelo
```

El `.env.example` de la API trae valores de desarrollo. Sin credenciales de proveedores todo funciona en local: Mercado Pago usa un simulador de pagos, Brevo registra los emails en el log (dry-run) y el botón de Google queda oculto. Variables, proveedores y detalles en [docs/development.md](docs/development.md).

### Variables de entorno

| App | Variable | Propósito |
|---|---|---|
| API | `NODE_ENV`, `PORT`, `WEB_URL`, `API_PUBLIC_URL` | Entorno, puerto y URLs públicas de la web y de la API |
| API | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` | Conexión a PostgreSQL (`DB_SSL=true` en Neon) |
| API | `BETTER_AUTH_SECRET`, `COOKIE_DOMAIN` | Secreto de sesiones y dominio de la cookie (`.move.uy` en producción) |
| API | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth (opcional; las dos o ninguna) |
| API | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | Mercado Pago (vacíos = simulador en desarrollo; obligatorios en producción) |
| API | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME` | Brevo (vacíos = dry-run en desarrollo; obligatorios en producción) |
| API | `SCHEDULER_ENABLED` | `true` o `false`; activo en una sola instancia |
| Web | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_ENABLED` | URL de la API (con `/api`) y botón de Google |

## Scripts raíz

| Script | Qué hace |
|---|---|
| `pnpm dev` | Web y API en modo watch |
| `pnpm dev:web` / `pnpm dev:api` | Una sola app |
| `pnpm build` / `pnpm lint` / `pnpm test` | Corre el script en todas las apps |
| `pnpm test:e2e` | E2E de la API contra Postgres (requiere `E2E_DATABASE_NAME`, ver [docs/development.md](docs/development.md#tests)) |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Postgres local |
| `pnpm manual:demo-data` | Carga datos de demostración inventados por HTTP contra la API local (ver [Manual de usuario](#manual-de-usuario)) |
| `pnpm manual:screenshots` | Captura una imagen de cada pantalla de la web en `docs/manual/img/` |
| `pnpm manual:pdf` | Genera `docs/manual/manual-de-usuario.pdf` desde el Markdown |

Scripts de la API (`pnpm --filter @move/api <script>`):

| Script | Qué hace |
|---|---|
| `seed` | Carga planes, horarios y configuración provisorios (idempotente) |
| `user:create-staff -- --email <e> --name <n>` | Crea un usuario staff; la contraseña va en `CREATE_STAFF_PASSWORD` (preferible a `--password`) |
| `test:e2e` | E2E de la API |
| `migration:generate` / `migration:run` / `migration:revert` / `migration:show` | Migraciones |

## Migraciones (API)

`synchronize` está desactivado: todo cambio de esquema va por migración. Los comandos compilan primero y usan `dist/database/data-source.js`.

```bash
pnpm --filter @move/api migration:generate src/database/migrations/<Nombre>
pnpm --filter @move/api migration:run
pnpm --filter @move/api migration:revert
pnpm --filter @move/api migration:show
```

Las tablas y columnas se nombran en snake_case automáticamente (`SnakeNamingStrategy`).

## Manual de usuario

[docs/manual/manual-de-usuario.md](docs/manual/manual-de-usuario.md) ([PDF](docs/manual/manual-de-usuario.pdf)) explica el sistema con una captura de cada pantalla, en tres partes: clientes, staff de MOVE y equipo técnico (correr todo en local, qué está simulado y los pasos que faltan para el deploy y las integraciones). Las capturas y el PDF se regeneran con `pnpm manual:demo-data`, `pnpm manual:screenshots` y `pnpm manual:pdf` (pasos y variables `MANUAL_STAFF_PASSWORD` / `MANUAL_CLIENT_PASSWORD` en la parte 3 del manual).

## Documentación

- [docs/manual/manual-de-usuario.md](docs/manual/manual-de-usuario.md): manual de usuario con capturas de todas las pantallas.
- [docs/development.md](docs/development.md): setup local, seed, staff, simulador de pagos, tests, jobs manuales y módulos de la API.
- [docs/deploy.md](docs/deploy.md): runbook de deploy (Neon, Elastic Beanstalk, Vercel, dominios, proveedores y checklist).
- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) y [apps/web/CLAUDE.md](apps/web/CLAUDE.md): convenciones del proyecto.

## CI y paquete de la API

`bitbucket-pipelines.yml` corre lint, tests, e2e de la API y build en cada PR y en `main` y `feature/*` (variable segura `CI_BETTER_AUTH_SECRET`). `bash scripts/package-api-eb.sh` genera `artifacts/move-api-<sha>.zip` para Elastic Beanstalk.
