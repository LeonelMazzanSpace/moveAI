# API (`@move/api`) — convenciones

NestJS 12 + TypeORM + PostgreSQL, ESM (`nodenext`). Contexto general en `README.md` y `docs/development.md`; deploy en `docs/deploy.md`. Este archivo prevalece sobre los defaults de SpaceDev donde difieran (Better Auth en vez de Clerk, Brevo en vez de Resend, NestJS Scheduler en vez de Bull/Redis, módulos simples en vez de hexagonal).

## Estructura

- Módulos por dominio en `src/modules/<modulo>/` con `controllers/`, `services/`, `entities/`, `dto/`, `models/` y `domain/` (funciones puras). Flujo controller → service → repositorio TypeORM. Sin puertos, adaptadores ni interfaces de proveedor.
- Las entidades TypeORM solo se usan dentro de los services de su módulo. Entre módulos circulan *models* (tipos planos en `models/`); los controllers responden DTOs u objetos planos, nunca entidades.
- Dependencias entre módulos acíclicas, en este orden (un módulo solo importa los de su izquierda): `common` → `settings` → `notifications` → `users` → `auth` → `catalog` → `schedule` → `subscriptions` → `bookings` → `payments` → `followup` → `clients` → `automations`. Sin `forwardRef`.
- `src/app.module.ts` es un archivo de registro compartido: agregar solo el import y la entrada en `imports: []` de tu módulo.
- Proveedores encapsulados: Mercado Pago solo en `modules/payments/services/mercado-pago.service.ts`; Brevo solo en `modules/notifications/services/brevo.service.ts`; la instancia de Better Auth solo en `modules/auth/`.

## TypeScript

- Strict, sin `any` (oxlint `no-explicit-any` = error) y sin promesas flotantes.
- Imports relativos con extensión `.js` aunque el archivo sea `.ts`.
- Exports con nombre; early returns; funciones chicas y de una sola responsabilidad; sin código comentado.

## Base de datos y migraciones

- El esquema cambia **solo** con migraciones generadas por el CLI: `pnpm --filter @move/api migration:generate src/database/migrations/<Nombre>` (o `migration:create` para datos). Nunca `synchronize`, nunca SQL a mano contra la base.
- Tablas y columnas en snake_case (`SnakeNamingStrategy`); propiedades de entidad en camelCase. Soft delete (`deletedAt`) en datos de negocio. Índices en FK y columnas de filtro; sin `SELECT *`.
- Las operaciones que tocan varias tablas o deben ser atómicas reciben un `EntityManager` y corren en `dataSource.transaction(...)`. Los emails se envían **después** del commit.
- Reservas: el conteo de cupo usa las reservas activas bajo `SELECT … FOR UPDATE` del turno.

## Fechas y zona horaria

- Toda regla de fechas usa los helpers de `src/common/time/business-time.ts` (zona `America/Montevideo`: `businessToday`, `toBusinessDate`, `businessDateTime`, `addDays`, `diffDays`, …).
- Las fechas de negocio son strings `YYYY-MM-DD`; los instantes son `timestamptz` / `Date` UTC.
- Prohibido `new Date().getDate()`, `toISOString().slice(0, 10)` y similares para fechas de negocio fuera de esos helpers.

## Errores, validación y seguridad

- Errores: `throw new AppError('<CODE>')` con códigos de `src/common/errors/error-codes.ts`. Nunca se exponen stack traces, SQL ni errores de proveedor.
- Inputs con DTOs `class-validator`; el `ValidationPipe` global usa `whitelist` y `forbidNonWhitelisted`.
- Autorización: guard global de sesión (`modules/auth`); `@Public()` para rutas abiertas y `@Roles('staff')` para `/api/staff/*`. Sin sesión → 401; rol insuficiente → 403; recurso de otro cliente → 404.
- `/api/auth/*` (Better Auth) rechaza bodies de más de 64 KB o con `Transfer-Encoding` sin `content-length`.
- Secretos solo por variables de entorno (definidas en `src/config/env.validation.ts`). Nada de secretos en código, tests ni `.env.example` (solo valores de desarrollo).
- Logs: solo ids y nombres de job o de plantilla. Nunca emails, nombres, teléfonos, tokens, contraseñas ni respuestas de check-in.
- Mercado Pago: webhook con firma válida, idempotente y con activación del plan en la misma transacción. El simulador de pagos solo existe sin `MP_ACCESS_TOKEN` y fuera de producción.

## Jobs

- Crons con `@nestjs/schedule`, siempre con `timeZone: BUSINESS_TZ` si dependen de la hora local. Corren bajo `JobRunner` (lock de Postgres): deben ser idempotentes.
- `SCHEDULER_ENABLED` solo acepta `true` o `false`; en producción, activo en una sola instancia.
- Los clientes en pausa no reciben alertas ni emails automáticos (salvo el re-contacto).

## Tests

- Unit con Vitest: `*.spec.ts` junto al código. `pnpm --filter @move/api test`.
- E2E con Vitest + supertest en `test/*.e2e-spec.ts`, contra la base `E2E_DATABASE_NAME` (migra sola); llamar a `resetDb` en `beforeEach`. `pnpm --filter @move/api test:e2e`.
- Cada bug o regla de negocio nueva lleva su test; para reservas y pagos, también el caso de concurrencia o repetición.

## Comandos

`pnpm --filter @move/api` + `dev` · `lint` · `test` · `test:e2e` · `build` · `seed` · `user:create-staff` · `migration:generate|run|revert|show`.

## Definition of Done

1. Pedido resuelto sin cambios fuera del alcance y sin comportamiento oculto nuevo.
2. `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `pnpm build` en verde.
3. Esquema cambiado solo por migración generada; variables nuevas agregadas a `env.validation.ts`, `.env.example` y `docs/deploy.md`.
4. Sin secretos, PII ni errores internos en logs ni respuestas.
5. Commits convencionales (`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`); PR hacia `main`, nunca push directo.
