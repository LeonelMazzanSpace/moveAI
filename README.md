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
pnpm --filter @move/api migration:run        # crea el esquema (en una base existente aplica las migraciones nuevas)
pnpm --filter @move/api seed                 # planes, horarios y configuración provisorios
pnpm dev                                     # web + api en paralelo
```

El `.env.example` de la API trae valores de desarrollo. Sin credenciales de proveedores todo funciona en local: Mercado Pago usa un simulador de pagos, Brevo registra los emails en el log (dry-run) y el botón de Google queda oculto. Variables, proveedores y detalles en [docs/development.md](docs/development.md). Para verla con datos de demostración, seguí [Probar MOVE en local](docs/manual/manual-de-usuario.md#probar-move-en-local).

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
| API | `TRUST_PROXY_HOPS` | Proxies delante de la API cuya entrada de `X-Forwarded-For` se acepta para tomar la IP del cliente: un dígito de 0 a 5, default `0`; `2` detrás del ALB + Nginx de Elastic Beanstalk; nunca `true` (ver [docs/deploy.md](docs/deploy.md)) |
| Web | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_ENABLED` | URL de la API (con `/api`) y botón de Google |

## Scripts raíz

| Script | Qué hace |
|---|---|
| `pnpm dev` | Web y API en modo watch |
| `pnpm dev:web` / `pnpm dev:api` | Una sola app |
| `pnpm build` / `pnpm lint` / `pnpm test` | Corre el script en todas las apps |
| `pnpm test:e2e` | E2E de la API contra Postgres (requiere `E2E_DATABASE_NAME`, ver [docs/development.md](docs/development.md#tests)) |
| `pnpm e2e:reset` / `pnpm test:e2e:web` / `pnpm lint:e2e` | Reinicia la base `move_e2e`, corre las pruebas end to end de la web con Playwright en desktop y mobile, y revisa su código (tsc y oxlint; `pnpm lint` lo incluye). Las pruebas requieren `E2E_STAFF_PASSWORD` y `E2E_CLIENT_PASSWORD`; ver [docs/development.md](docs/development.md#pruebas-end-to-end). |
| `pnpm db:up` / `pnpm db:down` / `pnpm db:logs` | Postgres local |
| `pnpm manual:demo-data` | Carga datos de demostración inventados por HTTP contra la API local (ver [Manual de usuario](#manual-de-usuario)) |
| `pnpm manual:screenshots` | Captura una imagen de cada pantalla de la web en `docs/manual/img/` |
| `pnpm manual:pdf` | Genera `docs/manual/manual-de-usuario.pdf` desde el Markdown |

Scripts de la API (`pnpm --filter @move/api <script>`):

| Script | Qué hace |
|---|---|
| `seed` | Carga planes, horarios y configuración provisorios (idempotente) |
| `user:create-staff -- --email <e> --name <n> [--promote-existing]` | Crea un usuario staff; la contraseña va en `CREATE_STAFF_PASSWORD` (preferible a `--password`). Si el email ya existe se rechaza, salvo con `--promote-existing` (D54), que convierte esa cuenta en staff; `--name` solo se usa al crear una cuenta nueva |
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

[docs/manual/manual-de-usuario.md](docs/manual/manual-de-usuario.md) ([PDF](docs/manual/manual-de-usuario.pdf)) es la guía única para clientes, staff de MOVE y equipo técnico, con una captura de cada pantalla y el diagrama de arquitectura:

- [Probar MOVE en local](docs/manual/manual-de-usuario.md#probar-move-en-local): pasos en orden para levantar todo con datos de demostración y la tabla de usuarios de demo.
- [Estado actual frente a MOVE.pdf](docs/manual/manual-de-usuario.md#estado-actual-frente-a-movepdf): hecho, simulado en local y pendiente, sección por sección.
- [Parte 1: Clientes](docs/manual/manual-de-usuario.md#parte-1-clientes) y [Parte 2: Staff de MOVE](docs/manual/manual-de-usuario.md#parte-2-staff-de-move).
- [Parte 3: Cómo levantar todo](docs/manual/manual-de-usuario.md#parte-3-cómo-levantar-todo): local paso a paso y producción en orden.
- [Parte 4: Proveedores, uno por uno](docs/manual/manual-de-usuario.md#parte-4-proveedores-uno-por-uno): Neon, AWS Elastic Beanstalk, Vercel, dominio y cookies, Mercado Pago, Google OAuth, Brevo y Bitbucket Pipelines, con ambientes separados y la tabla de variables.
- [Parte 5: Puesta en marcha y mantenimiento](docs/manual/manual-de-usuario.md#parte-5-puesta-en-marcha-y-mantenimiento): primer staff, checklist posterior al deploy, rollback y cómo regenerar el manual.

Las capturas y el PDF se regeneran con `pnpm manual:demo-data`, `pnpm manual:screenshots` y `pnpm manual:pdf`; el diagrama, con `node scripts/manual/render-diagram.mjs` (pasos y variables `MANUAL_STAFF_PASSWORD` / `MANUAL_CLIENT_PASSWORD` en [Regenerar este manual](docs/manual/manual-de-usuario.md#regenerar-este-manual)).

## Documentación

- [docs/manual/manual-de-usuario.md](docs/manual/manual-de-usuario.md): manual de usuario con capturas de todas las pantallas, [Probar MOVE en local](docs/manual/manual-de-usuario.md#probar-move-en-local), estado actual, cómo levantar todo y la guía de cada proveedor.
- [docs/development.md](docs/development.md): setup local, seed, staff, simulador de pagos, tests, jobs manuales y módulos de la API.
- [docs/deploy.md](docs/deploy.md): runbook de deploy (Neon, Elastic Beanstalk, Vercel, dominios, proveedores y checklist).
- [apps/api/CLAUDE.md](apps/api/CLAUDE.md) y [apps/web/CLAUDE.md](apps/web/CLAUDE.md): convenciones del proyecto.

## CI y paquete de la API

`bitbucket-pipelines.yml` corre lint, tests, e2e de la API y build en cada PR y en `main` y `feature/*` (variable segura `CI_BETTER_AUTH_SECRET`). `bash scripts/package-api-eb.sh` genera `artifacts/move-api-<sha>.zip` para Elastic Beanstalk.
