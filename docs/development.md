# Desarrollo local — MOVE

## Requisitos

- Node 24 (`nvm use` lee `.nvmrc`) y pnpm 10 (`corepack enable`)
- Docker (Postgres local)

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm db:up                                   # Postgres 17 en Docker (contenedor move-postgres, puerto 5432)
pnpm --filter @move/api migration:run        # crea el esquema
pnpm --filter @move/api seed                 # planes, horarios y configuración provisorios (idempotente)
pnpm dev                                     # web en :3000 y API en :3001 (/api)
```

El `.env.example` de la API trae valores de desarrollo listos para usar. Las variables de la API están documentadas en [deploy.md](deploy.md#variables-de-entorno-de-la-api); la web usa `NEXT_PUBLIC_API_URL` (`http://localhost:3001/api`) y `NEXT_PUBLIC_GOOGLE_ENABLED`.

El seed carga los planes, precios y horarios del mockup como valores **provisorios**: Configuración muestra "Valores provisorios — confirmar con MOVE" mientras el ajuste `valuesProvisional` sea `true`.

## Crear un usuario staff

Los clientes se registran desde la web. El staff se crea por línea de comandos:

```bash
read -rs CREATE_STAFF_PASSWORD && export CREATE_STAFF_PASSWORD   # preferible a pasar --password por argv
pnpm --filter @move/api user:create-staff -- --email staff@example.com --name "Nombre Apellido"
unset CREATE_STAFF_PASSWORD
```

Si el email ya existe, esa cuenta pasa a ser staff. El comando imprime solo el id. El nombre debe tener entre 2 y 80 caracteres y la contraseña al menos 8.

## Proveedores en desarrollo

Sin credenciales de proveedores todo funciona localmente:

| Servicio | Sin configurar | Con configurar |
|---|---|---|
| Mercado Pago | Simulador de pagos (solo si `MP_ACCESS_TOKEN` está vacío y `NODE_ENV` no es `production`) | Checkout real con `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` |
| Brevo | Dry-run: el email se registra en el log de la API y no se envía | Envío real con `BREVO_API_KEY` y `BREVO_SENDER_EMAIL` |
| Google OAuth | El botón de Google queda oculto (`NEXT_PUBLIC_GOOGLE_ENABLED` vacío) | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en la API y `NEXT_PUBLIC_GOOGLE_ENABLED=true` en la web |

**Simulador de pagos.** En el checkout aparece un panel de desarrollo para aprobar o rechazar la compra pendiente (llama a `POST /api/payments/dev/simulate` con `externalReference` y `outcome` `approved` o `rejected`). Con `MP_ACCESS_TOKEN` definido o con `NODE_ENV=production` ese endpoint responde `NOT_FOUND`. Un pago rechazado deja la compra en `pending`.

**Emails en dry-run.** Los emails (restablecer contraseña, invitación de cliente nuevo, check-ins, recordatorios) no salen: buscá la línea del envío en la consola de la API. Los logs no incluyen emails, nombres ni contenido, solo ids.

## Tests

Desde la raíz del repo:

| Comando | Qué corre |
|---|---|
| `pnpm test` | Unit tests de la API (Vitest) y de la web (Vitest + Testing Library) |
| `pnpm test:e2e` | E2E de la API (Vitest + supertest) contra Postgres real |
| `pnpm --filter @move/api test` / `pnpm --filter @move/web test` | Unit tests de una sola app |
| `pnpm lint` | oxlint (API) y ESLint (web) |
| `pnpm build` | Build de la API y de la web |

Los e2e de la API necesitan el Postgres local levantado y la variable `E2E_DATABASE_NAME` con el nombre de una base de test dedicada (distinta de la de desarrollo), que la suite migra sola y vacía con `resetDb` en cada test:

```bash
docker exec move-postgres createdb -U move move_test       # una sola vez
E2E_DATABASE_NAME=move_test pnpm test:e2e
```

No hay E2E de la web con navegador (se descartaron en el MVP): la web se cubre con tests de componentes y de utilidades, y con una prueba manual de las pantallas principales.

El pipeline de Bitbucket (`bitbucket-pipelines.yml`) corre el mismo gate en cada PR y en `main`/`feature/*`: `pnpm lint`, `pnpm test`, e2e de la API contra una base `move_ci_test` y `pnpm build`. Necesita la variable segura de repositorio `CI_BETTER_AUTH_SECRET`.

## Correr un job a mano

Los crons corren dentro de la API (los desactiva `SCHEDULER_ENABLED=false`). Para ejecutar uno en el momento, con sesión de **staff**:

```bash
curl -X POST http://localhost:3001/api/staff/automations/run/<job> --cookie "<cookie de sesión del staff>"
```

Jobs disponibles: `followup-detect`, `checkins-monthly`, `expiry-reminders`, `generate-slots`, `expire-holds`, `reconcile-payments`. La respuesta es `{ job, ran, result }`. Corre aunque `SCHEDULER_ENABLED` sea `false`, usa el mismo lock de Postgres que el cron (no se pisan) y es idempotente: repetirlo el mismo día no duplica alertas ni emails. `checkins-monthly` manual envía los check-ins aunque no sea el primer lunes del mes, pero un cliente recibe como máximo uno por mes calendario.

## Migraciones

`synchronize` está desactivado: el esquema cambia solo con migraciones generadas por el CLI.

```bash
pnpm --filter @move/api migration:generate src/database/migrations/<Nombre>
pnpm --filter @move/api migration:run
pnpm --filter @move/api migration:revert
pnpm --filter @move/api migration:show
```

Nunca se edita el esquema a mano ni se escribe una migración a mano que reemplace a `migration:generate`.

## Estructura de la API

Un módulo por dominio en `apps/api/src/modules/<modulo>/` con `controllers/`, `services/`, `entities/`, `dto/`, `models/` y `domain/` (funciones puras). El flujo es controller → service → repositorio TypeORM. Las entidades solo se usan dentro de los services de su módulo; entre módulos circulan *models* (tipos planos).

Un módulo solo importa módulos de la fila anterior (sin dependencias cíclicas ni `forwardRef`):

| # | Módulo | Responsabilidad | Puede importar |
|---|---|---|---|
| 1 | `common` | Errores (`AppError`), helpers de fecha (`business-time`), decoradores `@Roles`/`@Public`, `JobRunner`, paginación | — |
| 2 | `settings` | Configuración editable por el staff | `common` |
| 3 | `notifications` | Emails (Brevo o dry-run) y plantillas | `common`, `settings` |
| 4 | `users` | Usuarios y perfil | `common`, `settings`, `notifications` |
| 5 | `auth` | Better Auth y guard global de sesión | `common`, `settings`, `notifications`, `users` |
| 6 | `catalog` | Planes y paquetes | módulos 1–5 |
| 7 | `schedule` | Plantillas de horarios, profesionales y turnos (`time_slots`) | módulos 1–6 |
| 8 | `subscriptions` | Planes y paquetes vigentes de cada cliente | módulos 1–7 |
| 9 | `bookings` | Reservas, cupos, cancelación y asistencia | módulos 1–8 |
| 10 | `payments` | Checkout, Mercado Pago, webhook, pagos manuales y conciliación | módulos 1–9 |
| 11 | `followup` | Alertas, motivos de inactividad y check-ins | módulos 1–10 |
| 12 | `clients` | Listado, detalle y dashboard del staff | módulos 1–11 |
| 13 | `automations` | Ejecución de jobs (crons y corrida manual) | módulos 1–12 |

Los proveedores están encapsulados: Mercado Pago solo en `modules/payments/services/mercado-pago.service.ts`, Brevo solo en `modules/notifications/services/brevo.service.ts` y la instancia de Better Auth solo en `modules/auth/`.

Más convenciones (fechas, errores, logs, tests) en [`apps/api/CLAUDE.md`](../apps/api/CLAUDE.md) y [`apps/web/CLAUDE.md`](../apps/web/CLAUDE.md).
