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
pnpm --filter @move/api migration:run        # crea el esquema (en una base existente aplica las migraciones nuevas)
pnpm --filter @move/api seed                 # planes, horarios y configuración provisorios (idempotente)
pnpm dev                                     # web en :3000 y API en :3001 (/api)
```

El `.env.example` de la API trae valores de desarrollo listos para usar. En lugar de copiarlo a `apps/api/.env`, se puede exportar en el shell con `set -a; . apps/api/.env.example; set +a` (las variables exportadas tienen prioridad sobre un `.env`; hace falta `NODE_ENV=development`, que ya viene en el ejemplo). Hacelo solo en las consolas de la API y de los scripts del manual, **nunca en la de la web**: el ejemplo trae `PORT=3001` y la web toma su puerto de `PORT` (chocaría con la API). En la consola de la web exportá solo `NEXT_PUBLIC_API_URL`, o corré antes `unset PORT` (o `pnpm dev:web -p 3000`). Por la misma razón, con las variables exportadas no uses `pnpm dev` (web y API comparten el entorno): levantalas con `pnpm dev:api` y `pnpm dev:web` en consolas separadas. Las variables de la API están documentadas en [deploy.md](deploy.md#variables-de-entorno-de-la-api); la web usa `NEXT_PUBLIC_API_URL` (`http://localhost:3001/api`) y `NEXT_PUBLIC_GOOGLE_ENABLED`.

`PORT` y `DB_PORT` aceptan solo dígitos (1 a 65535), `DB_SSL` y `SCHEDULER_ENABLED` solo `true` o `false`, y `TRUST_PROXY_HOPS` un dígito de 0 a 5: otro valor impide que la API arranque. `TRUST_PROXY_HOPS` queda en `0` (el default) en local, donde no hay proxies delante de la API; detrás del ALB + Nginx de Elastic Beanstalk va `2` y nunca `true` (ver [deploy.md](deploy.md#proxy-ip-del-cliente-y-límites-de-checkout)).

La API solo interpreta bodies JSON: un POST con formulario codificado responde 400. Para una prueba rápida con datos de demostración (usuarios de ejemplo, reservas, pagos y alertas), seguir [Probar MOVE en local](manual/manual-de-usuario.md#probar-move-en-local) del manual.

El seed carga los planes, precios y horarios del mockup como valores **provisorios**: Configuración muestra "Valores provisorios — confirmar con MOVE" mientras el ajuste `valuesProvisional` sea `true`.

## Crear un usuario staff

Los clientes se registran desde la web. El staff se crea por línea de comandos:

```bash
printf 'Contraseña del staff: '; read -rs CREATE_STAFF_PASSWORD && export CREATE_STAFF_PASSWORD; echo   # preferible a pasar --password por argv
pnpm --filter @move/api user:create-staff -- --email staff@example.com --name "Nombre Apellido"
unset CREATE_STAFF_PASSWORD
```

El comando imprime solo el id. El nombre debe tener entre 2 y 80 caracteres y la contraseña al menos 8.

Si ya existe una cuenta con ese email, el comando la rechaza. Para convertirla en staff, agregar `--promote-existing`: la cuenta queda con la contraseña dada, se cierran sus sesiones y el email queda verificado. `--name` sigue siendo obligatorio, pero solo se usa al crear una cuenta nueva; el nombre de una cuenta existente no cambia.

```bash
pnpm --filter @move/api user:create-staff -- --email cliente@example.com --name "Nombre Apellido" --promote-existing
```

## Proveedores en desarrollo

Sin credenciales de proveedores todo funciona localmente:

| Servicio | Sin configurar | Con configurar |
|---|---|---|
| Mercado Pago | Simulador de pagos (solo si `MP_ACCESS_TOKEN` está vacío y `NODE_ENV` no es `production`) | Checkout real con `MP_ACCESS_TOKEN` y `MP_WEBHOOK_SECRET` |
| Brevo | Dry-run: el email se registra en el log de la API y no se envía | Envío real con `BREVO_API_KEY` y `BREVO_SENDER_EMAIL` |
| Google OAuth | El botón de Google queda oculto (`NEXT_PUBLIC_GOOGLE_ENABLED` vacío) | `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en la API y `NEXT_PUBLIC_GOOGLE_ENABLED=true` en la web |
| Google Calendar (Rehab) | Configuración → Calendario avisa que falta configurar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `CALENDAR_TOKEN_KEY` en la API |

**Simulador de pagos.** En el checkout aparece un panel de desarrollo para aprobar o rechazar la compra pendiente (llama a `POST /api/payments/dev/simulate` con `externalReference` y `outcome` `approved` o `rejected`). Con `MP_ACCESS_TOKEN` definido o con `NODE_ENV=production` ese endpoint responde `NOT_FOUND`. Un pago rechazado deja la compra en `pending`.

**Débito automático.** Con el simulador activo (mismas condiciones que arriba), el checkout de un plan con **Permite débito automático** (en la semilla: `performance-mensual`, `recovery-paquete-4` y `recovery-paquete-8`) ofrece **Débito automático**; al activarlo lleva a `/checkout/simulado?debito=<ref>`, donde se puede **Autorizar**, **Cobrar ciclo (aprobado)**, **Cobrar ciclo (rechazado)** y **Cancelar**. Por API: `POST /api/payments/dev/simulate-auto-debit` con `externalReference` y `action` (`authorize`, `charge_approved`, `charge_rejected` o `cancel`); responde `NOT_FOUND` con `MP_ACCESS_TOKEN` definido o en producción. Con un período de Performance vigente el primer cobro queda para el día siguiente a su fin; en Recovery, o sin período vigente, `authorize` cobra en el momento. `pnpm manual:demo-data` ya deja un débito de Performance (Martín) y uno de Recovery (Camila).

**Google Calendar.** No hay simulador de Google: sin las tres variables la pestaña Calendario avisa que falta configurar. Para probar la conexión de verdad, exportar en la consola de la API `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `CALENDAR_TOKEN_KEY` (`openssl rand -base64 32`, sin guardarla en un archivo), registrar en el cliente OAuth de Google la redirect URI `${API_PUBLIC_URL}/api/calendar/oauth/callback` (en local, `http://localhost:3001/api/calendar/oauth/callback`) y conectar desde Configuración → Calendario. Los jobs de push (cada minuto) y pull (cada 5 minutos) corren solos; **Sincronizar ahora** los dispara a mano. La clave y la forma de la sincronización están en [deploy.md](deploy.md) y en el [manual](manual/manual-de-usuario.md#google-calendar-sincronización-de-rehab).

**Emails en dry-run.** Los emails (restablecer contraseña, invitación de cliente nuevo, check-ins, recordatorios) no salen: buscá la línea del envío en la consola de la API. Los logs no incluyen emails, nombres ni contenido, solo ids. Para ver el aspecto de las 17 plantillas sin base ni red: `pnpm --filter @move/api emails:preview` escribe un HTML por plantilla y un `index.html` en `apps/api/tmp/email-preview/` (ignorada por git).

## Tests

Desde la raíz del repo:

| Comando | Qué corre |
|---|---|
| `pnpm test` | Unit tests de la API (Vitest) y de la web (Vitest + Testing Library) |
| `pnpm test:e2e` | E2E de la API (Vitest + supertest) contra Postgres real |
| `pnpm --filter @move/api test` / `pnpm --filter @move/web test` | Unit tests de una sola app |
| `pnpm lint` | oxlint (API), ESLint (web) y `pnpm lint:e2e` (tsc estricto y oxlint sobre `e2e/`, `playwright.config.ts` y `scripts/e2e`) |
| `pnpm build` | Build de la API y de la web |

Los e2e de la API necesitan el Postgres local levantado y la variable `E2E_DATABASE_NAME` con el nombre de una base de test dedicada (distinta de la de desarrollo), que la suite migra sola y vacía con `resetDb` en cada test:

```bash
docker exec move-postgres createdb -U move move_test       # una sola vez
E2E_DATABASE_NAME=move_test pnpm test:e2e
```

La web además tiene pruebas end to end con navegador (Playwright): ver [Pruebas end to end](#pruebas-end-to-end).

El pipeline de Bitbucket (`bitbucket-pipelines.yml`) corre el mismo gate en cada PR y en `main`/`feature/*`: `pnpm lint`, `pnpm test`, e2e de la API contra una base `move_ci_test` y `pnpm build`. Necesita la variable segura de repositorio `CI_BETTER_AUTH_SECRET`.

## Pruebas end to end

Suite de Playwright (`playwright.config.ts`, specs en `e2e/`) que recorre la web completa con dos proyectos que corren los mismos flujos:

| Proyecto | Navegador | Navegación |
|---|---|---|
| `desktop` | Chromium 1440×900 | Header público y de cliente, sidebar de staff |
| `mobile` | Dispositivo `iPhone 15` de Playwright con Chromium (viewport, touch y user agent móviles) | Menú móvil ("Abrir menú"); en cada pantalla se verifica que el documento no tenga scroll horizontal |

Flujos cubiertos, cada uno en los dos proyectos:

| Spec | Flujo |
|---|---|
| `public.spec.ts` | Visitante: inicio, Performance, Rehab, Recovery, Planes (precio `/paquete` en Recovery) y `/reservar` |
| `auth.spec.ts` | Registro, ingreso (y error de contraseña), logout, email repetido, guards (cliente fuera de `/staff`, staff fuera del área de clientes) y vuelta a la página exacta después de ingresar |
| `plan-purchase.spec.ts` | Compra de plan Performance con el simulador: aprobado → plan vigente en `/perfil`; rechazado → "Pago en proceso" y reintento |
| `performance-booking.spec.ts` | Reserva, límite de cupo (completo y `SLOT_FULL`), cancelación dentro y fuera del plazo, plan vencido bloquea reservas |
| `rehab-recovery.spec.ts` | Evaluación Rehab y sesión Recovery como invitado y con cuenta, `LOGIN_REQUIRED`, "Pago no completado" y reintento, paquete Recovery con saldo y tope `HOLD_LIMIT_REACHED` |
| `client-area.spec.ts` | Perfil, historial (filtros) y check-in mensual con molestia → alerta para el staff |
| `staff.spec.ts` | Dashboard y navegación, clientes (búsqueda, alta, detalle, pausa), turnos y asistencia, pagos (pago manual y filtros), seguimiento (contacto y gestionar), check-ins (derivar a Rehab) y configuración (planes, horarios, profesionales, reglas) |

Entorno propio, sin archivos `.env` (D61): base `move_e2e`, API en `:3150` (modo desarrollo: simulador de Mercado Pago, Brevo en dry-run, sin crons) y web con build de producción en `:3250`. Playwright compila y levanta los dos servidores (`webServer`) y los apaga al terminar; los puertos tienen que estar libres. El resto de las variables de la API (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `BETTER_AUTH_SECRET`…) se toman del entorno, con los valores de `apps/api/.env.example`.

```bash
set -a; source apps/api/.env.example; set +a                 # o exportarlas a mano (NODE_ENV no hace falta)
unset NODE_ENV
read -rs E2E_STAFF_PASSWORD && export E2E_STAFF_PASSWORD     # contraseña del staff de E2E (mínimo 8 caracteres)
read -rs E2E_CLIENT_PASSWORD && export E2E_CLIENT_PASSWORD   # contraseña de los clientes que crean las pruebas
pnpm exec playwright install chromium                        # una sola vez
pnpm e2e:reset                                               # borra y recrea move_e2e: migraciones, seed, staff y datos mínimos
pnpm test:e2e:web                                            # las dos suites; --project=desktop o --project=mobile para una
```

- Toda entrada (`pnpm e2e:reset`, `pnpm test:e2e:web` y el SQL de las specs) se niega antes de tocar nada si `E2E_DB_NAME` no empieza con `move_e2e`, y el reset y la suite solo aceptan el Postgres del contenedor local: `DB_HOST` `localhost`, `127.0.0.1` o `::1`, y `DB_PORT` sin definir o igual al puerto que publica `move-postgres` (`docker port`).
- `pnpm e2e:reset` (`scripts/e2e/reset.mjs`) crea el staff `staff.e2e@example.com` (`E2E_STAFF_EMAIL`) y, por la API, el profesional "Profesional E2E" y los turnos de la ventana de reserva. Usa el contenedor `move-postgres` (`E2E_DB_CONTAINER`).
- Cada prueba crea sus propios clientes, turnos (en un día y minuto únicos) y compras por la API, así que no depende del orden ni de las otras pruebas, y las fechas se calculan desde hoy en la zona de Uruguay. Lo que la API no permite (un plan vencido, un turno de hoy para marcar asistencia) se ajusta con SQL en `move_e2e`, como `scripts/manual/demo-data.mjs`.
- La API de E2E corre con `TRUST_PROXY_HOPS=1` y cada prueba manda su propio `X-Forwarded-For`, así el throttling por IP del checkout (D53/D58) no mezcla pruebas que corren en paralelo. No cambia nada de la app.
- El reporte HTML queda en `artifacts/e2e/report` (`pnpm exec playwright show-report artifacts/e2e/report`) y las capturas y trazas, solo de las pruebas que fallan, en `artifacts/e2e/results`. `artifacts/` está ignorado por git.
- `E2E_WORKERS` (entero de 1 a 99, default 4) fija los workers de Playwright.
- La suite no corre en Bitbucket Pipelines; su código sí se revisa con `pnpm lint:e2e`, incluido en `pnpm lint`.

## Auditoría responsive

`pnpm responsive:audit` recorre todas las rutas de la web a 375, 768, 1024 y 1440 px contra una API y una web locales con los datos de `pnpm manual:demo-data`. Necesita `MANUAL_STAFF_PASSWORD`, `MANUAL_CLIENT_PASSWORD`, `API_URL` y `WEB_URL`; estas dos no tienen valor por defecto y el script rechaza los puertos 3000 y 3001. Detalle de lo que revisa y de su estado en [responsive-audit.md](responsive-audit.md).

## Correr un job a mano

Los crons corren dentro de la API (los desactiva `SCHEDULER_ENABLED=false`). Para ejecutar uno en el momento, con sesión de **staff**:

```bash
curl -X POST http://localhost:3001/api/staff/automations/run/<job> --cookie "<cookie de sesión del staff>"
```

Jobs disponibles: `followup-detect`, `checkins-monthly`, `expiry-reminders`, `generate-slots`, `expire-holds`, `reconcile-payments`, `booking-reminders`. La respuesta es `{ job, ran, result }`. Corre aunque `SCHEDULER_ENABLED` sea `false`, usa el mismo lock de Postgres que el cron (no se pisan) y es idempotente: repetirlo el mismo día no duplica alertas ni emails. `checkins-monthly` manual envía los check-ins aunque no sea el primer lunes del mes, pero un cliente recibe como máximo uno por mes calendario.

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
