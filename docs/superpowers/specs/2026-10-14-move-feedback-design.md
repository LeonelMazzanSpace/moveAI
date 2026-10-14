# MOVE — Comentarios del cliente (2026-10-14): diseño

**Estado:** aprobado en conversación por el usuario (2026-10-14), sección por sección. Pendiente: revisión de este documento.
**Rama de coordinación:** `feature/move-feedback` (desde `main` e07c455). Worktree de coordinación: `Move.worktrees/coord-feedback`. La raíz `Move` sigue en `main` (ahí corre la app del usuario).
**Ejecución:** plan Herdr (writing-herdr-plans → executing-herdr-plans), como las tandas anteriores.

## Origen

Comentarios recibidos sobre la app:

1. INFORMACIÓN: agregar sección de equipo.
2. INFORMACIÓN: agregar detalles del cuarto de Recovery.
3. Conectar un Google Calendar con la sección Rehab, con un botón en el admin para conectarlo.
4. La sección Performance muestra "PLAN VENCIDO" con un plan activo.
5. Revisar el responsive de la página.
6. Agregar la integración con Mercado Pago y probarla (suscripciones y pago único).
7. Revisar los correos desde la página.

## Objetivo

Que la app nueva reemplace a moveperformance.uy sin perder lo que el sitio actual muestra o vende, y resolver los siete comentarios. Éxito = cada paquete con tests y gate verdes, E2E desktop + mobile verdes, manual actualizado y un checklist de prueba real por proveedor para cuando haya credenciales.

## Supuestos y límites

- **Sin credenciales todavía** (MP, Google Calendar, Brevo): todo se implementa y se prueba con simulador y fakes; la prueba real queda como checklist (sección "Prueba real").
- **Fuera de alcance** (existen en el sitio actual, no se pidieron): precio socio 50 % OFF, códigos de descuento, "primera sesión". Se anotan en el manual como diferencias con el sitio actual.
- Se mantienen las reglas del plan MVP (`docs/superpowers/plans/2026-10-13-move-mvp.md`): orden de módulos de la API sin `forwardRef`, un proveedor por service, REST con `fetch` sin SDK (D17), mails después del commit, jobs con `JobRunner`, migraciones solo por CLI, sin PII ni tokens en logs, fechas de negocio con `business-time.ts`, textos en voseo rioplatense, tokens del tema sin hex.

## Decisiones

| # | Decisión | Fuente |
|---|---|---|
| D90 | Equipo y Recovery Room son **contenido fijo** en la web (sin CMS ni carga dinámica). Fotos como assets estáticos en `apps/web/public/img/`, descargadas de moveperformance.uy. Texto textual del sitio actual (Anexo A). | Usuario |
| D91 | Datos de contacto **editables desde el admin** (pestaña "Contacto"), guardados en `settings` (se amplía el tipo de valor a `string`). Se muestran en el footer público, en una sección "Dónde estamos" del inicio y en el pie de todos los mails. Sin mapa embebido: link "Abrir en Google Maps". | Usuario + orquestador |
| D92 | La caja fija "Plan vencido:" de `/performance` se reescribe como regla, no como estado. El aviso de estado real ya existe (`PlanRequiredNotice`, solo tras un rechazo `PLAN_REQUIRED`). Causa del comentario 4. | Orquestador, aprobado |
| D93 | Mails nuevos: `booking-cancelled-by-client`, `booking-not-confirmed`, `booking-reminder` (día anterior 18:00, solo Rehab y Recovery), `staff-rehab-booking` (al email de avisos del staff). Más pie de contacto en todos y `pnpm emails:preview`. | Usuario ("3 sí, ponelo") |
| D94 | Google Calendar ↔ Rehab **en ambos sentidos**, con **un solo calendario de MOVE** conectado desde Configuración → "Calendario". OAuth propio para staff (separado del login con Google), refresh token cifrado AES-256-GCM. | Usuario |
| D95 | Un ocupado de Google sobre un turno que ya tiene reserva **no cancela la reserva**: se avisa al staff por mail y se marca el turno en `/staff/turnos`. El evento lleva solo el nombre del cliente. | Usuario ("sí, va así") |
| D96 | Débito automático con Mercado Pago (`preapproval`) para los planes que el staff marque ("Permite débito automático"); semilla: Performance mensual y los dos packs Recovery. Convive con el pago único. | Usuario |
| D97 | Reglas del débito: uno activo por cliente y servicio; en **Performance** no se puede comprar un pago único con débito activo (en Recovery sí); el monto queda fijado al contratar; **sin pausa**; cancelar deja vigente lo ya pagado. | Usuario ("sí, va así") |
| D98 | Responsive: auditoría completa (375 / 768 / 1024 / 1440 px) **al final**, después de los paquetes que agregan pantallas. | Orquestador, aprobado |

## Paquete A — Landing: Equipo, Recovery Room y "Plan vencido"

**Equipo.** Sección nueva en el inicio (`app/(public)/page.tsx`), después de Servicios, con `id="equipo"`: eyebrow "Quiénes somos", título "El equipo detrás de MOVE", párrafo introductorio y una tarjeta por persona (foto 3:4, nombre, rol, bio, especialidades como chips). Contenido textual del Anexo A en un archivo de datos tipado (p. ej. `components/public/team-data.ts`). Grid 1 / 2 / 3 columnas (base / `sm` / `lg`). Enlace "Equipo" en el nav público (`nav-items.ts`) apuntando a `/#equipo`.

**Recovery Room.** Sección nueva en `/recovery` entre el Hero y "Modalidades y planes", `id="recovery-room"`: título "Recovery Room by MOVE", párrafo, 3 fotos (4:5) y 5 tarjetas de equipamiento (ícono de `lucide-react`, título y descripción; sin emojis).

**Fotos.** Seis JPG (≈50–70 KB c/u) descargados a `apps/web/public/img/equipo/` y `apps/web/public/img/recovery/`, servidos con `next/image` (locales: no hace falta `remotePatterns`). `alt` textual del Anexo A.

**"Plan vencido".** En `app/(public)/performance/page.tsx` la caja pasa a: **"Plan vigente:"** "para reservar necesitás un plan activo en la fecha del turno. Si tu plan vence, renovalo desde tu perfil para seguir reservando." Sin cambios en la API.

**Tests.** Render de ambas secciones (nombres, especialidades, 5 equipos, `alt` de las fotos), regla nueva en `/performance` sin el texto "Plan vencido:".

## Paquete B — Contacto editable

**Datos** (claves nuevas en `settings`, valor `string`, `''` = no se muestra):

| Campo | Clave | Validación | Semilla |
|---|---|---|---|
| `contactAddress` | `contact_address` | ≤ 200 | `Máximo Tajes 6397 esquina Beranger` |
| `contactHours` | `contact_hours` | ≤ 200 | `Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00` |
| `contactWhatsapp` | `contact_whatsapp` | `''` o `+` y 8–15 dígitos (espacios permitidos) | `+598 99 140 299` |
| `contactInstagram` | `contact_instagram` | `''` o `@` + `[A-Za-z0-9._]{1,30}` | `@move_strengthconditioning` |
| `contactEmail` | `contact_email` | `''` o email ≤ 254 | `''` |
| `contactMapsUrl` | `contact_maps_url` | `''` o URL `https://` ≤ 500 | URL de Google Maps del sitio actual (Anexo A) |
| `staffNotificationsEmail` | `staff_notifications_email` | `''` o email ≤ 254 | `''` |

- **API:** `SettingValue` pasa a `number | boolean | string`; los valores de contacto se agrupan en un tipo `ContactInfo` aparte de `SettingsValues` para no mezclar reglas operativas con contacto. Endpoints:
  - `GET /api/settings/contact` (público) → `ContactInfoDto` **sin** `staffNotificationsEmail`.
  - `GET /api/staff/settings/contact` y `PATCH /api/staff/settings/contact` (staff) → con `staffNotificationsEmail`. Trim de todos los campos antes de validar.
  - Migración de datos con las semillas (las filas existentes no cambian).
- **Web:**
  - Pestaña **"Contacto"** en `/staff/configuracion` (mismo patrón que Reglas: RHF + Zod espejo de los límites, errores de campo con copy propio).
  - `PublicFooter`: dirección, horarios, WhatsApp (`https://wa.me/<dígitos>`), Instagram (`https://www.instagram.com/<handle>/`), email (`mailto:`), link a Maps; Server Component dentro de `<Suspense>` (`cacheComponents`), si la API falla el footer se muestra sin el bloque de contacto.
  - Sección **"Dónde estamos"** al final del inicio con los mismos datos y CTA "Abrir en Google Maps" y "Escribinos por WhatsApp".
- Los links se construyen en un helper (`lib/contact.ts`) con tests.

## Paquete C — Mails

- **Pie de contacto** en `templates/layout.ts` (HTML y texto): dirección, horarios, WhatsApp, Instagram, email si hay. `NotificationsService` lee `ContactInfo` de `settings` al armar el mail (settings está a la izquierda de notifications).
- **Revisión de copy** de las 9 plantillas actuales (`password-reset`, `account-invitation`, `booking-confirmed`, `booking-cancelled`, `purchase-approved`, `plan-expiring`, `plan-expired`, `checkin-invite`, `rehab-referral`): voseo, datos útiles (fecha y hora con `America/Montevideo`, servicio, profesional si es Rehab), CTA correcto, "contactá a MOVE" con el WhatsApp. Sin cambiar asuntos salvo error.
- **Vista previa:** script `pnpm emails:preview` (API) que renderiza todas las plantillas con datos de ejemplo a `apps/api/tmp/email-preview/*.html` + `index.html` (carpeta ignorada por git). Sin red ni base.
- **Destinatario staff:** `NotificationsService` suma un envío a dirección fija (para `staffNotificationsEmail`); si está vacío, se registra `skipped` con motivo, sin error. Misma idempotencia por `idempotency_key`.
- **Plantillas nuevas:**

| Plantilla | Disparo | Destinatario | Clave de idempotencia |
|---|---|---|---|
| `booking-cancelled-by-client` | `cancelByClient`, después del commit | cliente | `booking-cancelled-by-client:<bookingId>` |
| `booking-not-confirmed` | `releaseHold` por pago rechazado y `expireHolds` (la query devuelve las filas expiradas) | cliente | `booking-not-confirmed:<bookingId>` |
| `booking-reminder` | job nuevo `booking-reminders`, diario 18:00 Montevideo: reservas `confirmed` de Rehab y Recovery que empiezan el día de negocio siguiente | cliente | `booking-reminder:<bookingId>` |
| `staff-rehab-booking` | reserva de Rehab confirmada (`sendBookingConfirmation`) o cancelada (cliente, staff) | `staffNotificationsEmail` | `staff-rehab-booking:<bookingId>:<confirmed\|cancelled>` |

El recordatorio es transaccional: se envía también a clientes en pausa (D11 aplica a mails de retención). El job se registra en `JOB_NAMES`, `AutomationsService` y `JobName` de la web.

## Paquete D — Google Calendar ↔ Rehab

**Módulo** `calendar` en la API, **último** en el orden de módulos (`… → automations → calendar`): lee reservas y turnos, escribe la marca de bloqueo; nadie lo importa. Un único service habla con Google (`google-calendar.service.ts`, REST con `fetch`, timeout 10 s).

**Datos**
- `calendar_connections` (como máximo una fila no borrada): `google_account_email`, `calendar_id`, `calendar_name`, `refresh_token_enc` (AES-256-GCM, IV aleatorio, `iv:tag:ciphertext` en base64), `status` (`connected` | `needs_reconnect`), `last_push_at`, `last_pull_at`, `last_error_code`, `connected_by`, timestamps, soft delete.
- `calendar_event_links`: `booking_id` (único), `google_event_id`, `created_at`.
- `time_slots.calendar_blocked_at timestamptz null` (entidad de `schedule`).

**Conexión** (staff)
- `POST /api/staff/calendar/connect` → `{ authUrl }`. Scopes: `openid email https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly`, `access_type=offline`, `prompt=consent`. `state` firmado (HMAC con clave derivada de `CALENDAR_TOKEN_KEY`) con id del staff, nonce y vencimiento de 10 min.
- `GET /api/calendar/oauth/callback` → exige sesión staff (la cookie de la API viaja en la navegación) y `state` válido del mismo staff; intercambia el `code`, guarda el refresh token cifrado y el email de la cuenta, y redirige a `${WEB_URL}/staff/configuracion?tab=calendario&calendar=connected` (o `=error`). Sin detalles internos en la URL.
- `GET /api/staff/calendar` → `{ configured, status, accountEmail, calendarId, calendarName, lastPushAt, lastPullAt }`. `configured = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && CALENDAR_TOKEN_KEY`.
- `GET /api/staff/calendar/calendars` → calendarios con `accessRole` `owner` o `writer`.
- `PATCH /api/staff/calendar` `{ calendarId }` → elige el calendario (debe estar en la lista).
- `POST /api/staff/calendar/sync` → corre push + pull en el momento.
- `DELETE /api/staff/calendar` → revoca el token en Google (si falla, sigue), borra la conexión y los links, limpia `calendar_blocked_at`. Los eventos ya creados quedan en Google.

**MOVE → Google** (job `calendar-push`, cada minuto, `JobRunner`)
- Reservas de Rehab `confirmed` que terminan en el futuro y no tienen link → `events.insert` con id determinístico (`move` + uuid de la reserva sin guiones; 409 = ya existe → se guarda el link). `summary`: `Rehab · Evaluación — <Nombre Apellido>` o `Rehab · Seguimiento — <Nombre Apellido>`; `description`: `Profesional: <nombre>` y "Reserva creada desde MOVE"; `extendedProperties.private.moveBookingId`.
- Links cuya reserva ya no está `confirmed` → `events.delete` (404/410 = ok) y se borra el link.
- Error de Google en un ítem: se registra el código y se reintenta en la próxima pasada; nunca toca la reserva.

**Google → MOVE** (job `calendar-pull`, cada 5 min)
- `events.list` del calendario elegido, de ahora a ahora + `bookingWindowDays` + 1 día, `singleEvents=true`, con paginación. Ocupado = evento `confirmed`/`tentative`, `transparency != transparent`, sin `extendedProperties.private.moveBookingId`, y sin respuesta `declined` del propio calendario. Eventos de día completo = el día completo en `America/Montevideo`.
- Turnos de Rehab no cancelados de esa ventana: se pone `calendar_blocked_at = now()` a los que se pisan con un ocupado y `NULL` a los que ya no. Solo se toca la ventana consultada.
- **Conflicto (D95):** turno recién bloqueado con reserva activa → mail `staff-calendar-conflict` (clave `staff-calendar-conflict:<slotId>`) y la reserva sigue.

**Disponibilidad.** Un turno con `calendar_blocked_at` no nulo no es reservable: se agrega a `isBookable` y a las consultas de `slot-stats.service.ts` (`listPublicSlots`, `availability`) y a los chequeos bajo lock (`assertBookable`, `CheckoutService.assertSlotOpen`). Se rechaza con el mismo código que un turno cancelado.

**Errores.**
- `invalid_grant` o 401 persistente → `status = needs_reconnect`, se limpian los bloqueos (los turnos quedan libres), mail `staff-calendar-disconnected` (clave por conexión y día). Push y pull se pausan hasta reconectar; al reconectar se crean los eventos pendientes.
- Errores transitorios (red, 5xx, 429) → se mantienen los últimos bloqueos y se reintenta.
- Códigos nuevos: `CALENDAR_NOT_CONFIGURED`, `CALENDAR_NOT_CONNECTED`, `CALENDAR_INVALID_CALENDAR`, `CALENDAR_PROVIDER_ERROR`.

**Env.** `CALENDAR_TOKEN_KEY` (32 bytes en base64, opcional; si está, se valida el largo). Redirect URI = `${API_PUBLIC_URL}/api/calendar/oauth/callback`. Se documenta en `env.validation.ts`, `.env.example`, `docs/deploy.md`.

**Web.**
- Pestaña **"Calendario"** en Configuración con estados: no configurado (texto + qué falta), desconectado ("Conectar Google Calendar"), conectado sin calendario (selector), conectado (cuenta, calendario, última sincronización, "Sincronizar ahora", "Desconectar" con confirmación), requiere reconexión ("Reconectar"). Lee `?calendar=connected|error` para un toast.
- `/staff/turnos`: badge "Ocupado en Google Calendar" en turnos bloqueados y destacado de conflicto si además tienen reserva.

## Paquete E — Débito automático con Mercado Pago

**Datos**
- `plans.auto_debit_enabled boolean not null default false`; CHECK: solo `period_plan` o `session_pack`. Checkbox en el formulario de planes. Frecuencia derivada: `period_plan` → `periodMonths` meses; `session_pack` → `periodDays` días. Semilla: `performance-mensual`, `recovery-paquete-4`, `recovery-paquete-8`.
- `auto_debits`: `user_id`, `plan_id`, `service`, `external_reference` (uuid único), `mp_preapproval_id` (único, nulo hasta crear), `status` (`pending` | `authorized` | `cancelled`), `amount` (fijado al contratar), `frequency`, `frequency_type` (`months` | `days`), `next_charge_date`, `cancelled_at`, `cancel_reason` (`client` | `staff` | `provider` | `expired`), timestamps. Índice único parcial `(user_id, service) WHERE status IN ('pending','authorized')`.
- `purchases.auto_debit_id` (nulo, FK). Cada cobro = una compra nueva `kind = plan`, `method = mercadopago`, con su propio `external_reference`; el pago se registra en `payments` (`mp_payment_id` único = idempotencia).
- Módulo: lógica en `payments` (está a la derecha de `subscriptions`); todas las llamadas a MP en `mercado-pago.service.ts`.

**Mercado Pago** (REST): `POST /preapproval` (`reason`, `external_reference`, `payer_email` = email del cliente, `auto_recurring { frequency, frequency_type, transaction_amount, currency_id: 'UYU', start_date? }`, `back_url` = `${WEB_URL}/checkout/resultado?debito=<ref>`, `status: 'pending'`) → `init_point`; `GET /preapproval/{id}`; `PUT /preapproval/{id}` `{ status: 'cancelled' }`; `GET /authorized_payments/{id}`; búsqueda de cobros por preapproval; `GET /v1/payments/{id}` para verificar estado y monto.

**Reglas**
- Solo clientes con sesión; el plan debe estar activo y con `auto_debit_enabled` (`AUTO_DEBIT_NOT_ALLOWED`).
- Uno activo por cliente y servicio (`AUTO_DEBIT_ACTIVE`); un `pending` previo del mismo servicio se cancela al iniciar uno nuevo.
- Performance con débito `authorized`: `POST /checkout/plan` devuelve `AUTO_DEBIT_ACTIVE`. Recovery: permitido.
- Performance con período vigente al contratar: `start_date` = día siguiente al fin del último período (el primer cobro llega cuando se termina lo ya pagado). Sin período vigente o Recovery: cobro inmediato.
- Cada cobro aprobado → compra + pago + `activateFromPurchase` en una transacción (R3 encadena Performance; el pack empieza el día del cobro). Monto comparado contra `auto_debits.amount` (no contra el precio actual del plan); diferencia → `needs_attention`, como hoy.
- Cobro rechazado → mail `auto-debit-charge-failed` (clave por id de cobro). MP reintenta solo.
- Suscripción cancelada (MOVE, cliente en MP o MP) → `cancelled` + mail `auto-debit-cancelled` (clave por débito). Lo pagado sigue vigente.
- `pending` sin autorizar en 24 h → se cancela en MP y queda `cancelled` / `expired`, sin mail.
- Mientras haya débito `authorized` de Performance no sale `plan-expiring`; `plan-expired` sí, si el período se corta.

**Avisos y conciliación**
- Webhook: además de `payment`, procesa `subscription_preapproval` (refresca el estado) y `subscription_authorized_payment` (cobro), con la misma firma. Cualquier otro tipo se sigue ignorando.
- `reconcilePending` suma: refrescar débitos `pending` y `authorized`, aplicar cobros aprobados no aplicados de los últimos 40 días, vencer `pending` de más de 24 h. Respaldo de D68 (si los avisos no llegan firmados).

**Endpoints**
- `POST /api/checkout/auto-debit` `{ planSlug }` → `{ initPoint, externalReference }` (mismo throttler que el checkout).
- `GET /api/checkout/auto-debits/:ref` → estado para `/checkout/resultado`.
- `GET /api/me/auto-debits`, `POST /api/me/auto-debits/:id/cancel`.
- `POST /api/staff/clients/:id/auto-debits/:autoDebitId/cancel`; el resumen del cliente incluye sus débitos.
- `GET /api/staff/payments` suma `origin` (`one_time` | `auto_debit`) y filtro `origen`.
- Simulador (solo no producción, D59): `POST /api/payments/dev/simulate-auto-debit` `{ externalReference, action: 'authorize' | 'charge_approved' | 'charge_rejected' | 'cancel' }`; el `initPoint` simulado es `/checkout/simulado?debito=<ref>`.

**Web**
- `/checkout/plan/[slug]`: si el plan lo permite, opción "Pago único" / "Débito automático" (radio) con texto de cuándo se cobra; si Performance ya tiene débito, mensaje y sin botón de compra.
- `/checkout/resultado?debito=<ref>`: pendiente de autorización / activo (próximo cobro) / cancelado.
- `/checkout/simulado?debito=<ref>`: Autorizar, Cobrar ciclo (aprobado / rechazado), Cancelar.
- `/perfil`: "Débito automático activo · próximo cobro dd/mm" + "Cancelar débito" con confirmación, en la tarjeta de plan y en la de packs.
- Staff: estado del débito y "Cancelar débito" en la ficha del cliente; badge "Débito automático" y filtro en `/staff/pagos`; checkbox en el formulario de planes.

## Paquete F — Responsive, E2E, manual y vault

- Auditoría de todas las rutas (públicas, cliente, staff, pestañas nuevas) a 375, 768, 1024 y 1440 px; fixes. Conocidos: `app/staff/layout.tsx` `p-8` → `p-4 md:p-8`; grids `lg:` en `rehab-booking-flow.tsx` y `checkins-view.tsx`; nav de pestañas de Configuración (ahora 6) con scroll horizontal o wrap.
- E2E Playwright: `ui.visit` + `expectFits` para las rutas no cubiertas (`/historial`, `/check-in`, `/recuperar`, `/continuar`, `/checkout/resultado`, `/checkout/simulado`, todas las pestañas de Configuración) y flujos nuevos (secciones Equipo y Recovery Room, pestaña Contacto y footer, débito automático con simulador, pestaña Calendario "no configurado").
- Manual: capturas nuevas y pasada mobile (390 × 844) de las pantallas principales; sección de débito automático, calendario, contacto y checklist de prueba real.
- Vault: sync incremental por MCP.

## Errores nuevos (contrato)

`AUTO_DEBIT_NOT_ALLOWED` (409), `AUTO_DEBIT_ACTIVE` (409), `AUTO_DEBIT_NOT_FOUND` (404), `CALENDAR_NOT_CONFIGURED` (409), `CALENDAR_NOT_CONNECTED` (409), `CALENDAR_INVALID_CALENDAR` (400), `CALENDAR_PROVIDER_ERROR` (502). Cada uno en `error-codes.ts`, el union de `types.ts`, `ERROR_MESSAGES` de la web y el contrato del plan.

## Tests

- API unit: cifrado (ida y vuelta, tag alterado falla), `state` OAuth (firma, vencimiento, otro staff), cálculo de ocupados (día completo, transparente, declinado, propio de MOVE), frecuencia y `start_date` del débito, selección de recordatorios, plantillas nuevas en `templates.spec.ts`.
- API e2e: Google y MP falsos con `overrideProvider` (patrón de `webhook.e2e-spec.ts`); concurrencia o repetición en todo lo que toca pagos (cobro duplicado por webhook + conciliación, dos checkouts de débito a la vez); turno bloqueado no reservable por ninguna ruta; conflicto no cancela; `needs_reconnect` libera turnos.
- Web: Vitest + Testing Library para cada componente nuevo y estados de carga/vacío/error.
- Gate por tarea y final: install, lint (con `lint:e2e`), test, e2e API, build, E2E Playwright 2 proyectos.

## Prueba real (checklist para cuando haya credenciales)

- **Mercado Pago:** confirmar que Suscripciones (`preapproval`) está habilitado para la cuenta de Uruguay; usuarios de prueba vendedor y comprador; verificar si MP exige que `payer_email` coincida con la cuenta del comprador (si lo exige: campo "email de tu cuenta de Mercado Pago" en el checkout); webhook público (túnel) y D68.
- **Google Calendar:** habilitar Calendar API en el proyecto; registrar la redirect URI; pantalla de consentimiento en **producción** (en "testing" el refresh token vence a los 7 días); generar `CALENDAR_TOKEN_KEY`.
- **Brevo:** API key y remitente verificado; mandar cada plantilla a una casilla de prueba.

## Anexo A — Contenido del sitio actual (moveperformance.uy, 2026-10-14)

Fotos (descargar de `https://www.moveperformance.uy` + ruta):

| Ruta origen | Destino | `alt` |
|---|---|---|
| `/img/pierina-paladini.jpg` | `public/img/equipo/pierina-paladini.jpg` | Pierina Paladini, fisioterapeuta deportiva y co-fundadora de MOVE® |
| `/img/gianluca-pasini.jpg` | `public/img/equipo/gianluca-pasini.jpg` | Gianluca Pasini, entrenador de fuerza y potencia y co-fundador de MOVE® |
| `/img/leandro-olenchuk.jpg` | `public/img/equipo/leandro-olenchuk.jpg` | Leandro Olenchuk, entrenador en MOVE® |
| `/img/recovery/recovery-zero-gravity-chair.jpg` | `public/img/recovery/recovery-zero-gravity-chair.jpg` | Sillón de gravedad cero del Recovery Room by MOVE |
| `/img/recovery/recovery-sauna-infrarrojo.jpg` | `public/img/recovery/recovery-sauna-infrarrojo.jpg` | Sauna infrarrojo del Recovery Room by MOVE |
| `/img/recovery/recovery-luz-roja-panel.jpg` | `public/img/recovery/recovery-luz-roja-panel.jpg` | Panel de luz roja e infrarroja del Recovery Room by MOVE |

**Equipo — introducción.** "Formación académica, actualización constante y experiencia en piso. Detrás de cada plan hay profesionales que combinan educación física, fisioterapia y entrenamiento especializado para que entrenes con criterio."

**Pierina Paladini** — *Fisioterapeuta deportiva | Co-fundadora*
Licenciada en Fisioterapia y Licenciada en Educación Física, Recreación y Deporte, con 7 años de experiencia clínica y más de 15 entrenando personas. Esa doble formación define su manera de trabajar: no separa el tratamiento del entrenamiento. Cada consulta es individual y diseñada a medida —evaluación clínica, historia de la persona y contexto de vida— porque ningún cuerpo responde igual y ahí está la diferencia en los resultados. Acompaña tanto a deportistas como a personas que llegan con dolor —agudo o crónico—, con una lesión o con miedo a volver a moverse, combinando herramientas de alta tecnología y progresión medida. El objetivo no es solo que el cuerpo deje de doler, sino que vuelva a rendir. En MOVE lidera el área de fisioterapia y conecta el tratamiento con el entrenamiento y la recuperación.
Especialidades: Ecografía músculo-esquelética · Punción seca · Neuromodulación · MEP Sport · MEP eco-guiado · Ondas de Choque · Tecarterapia · Entrenamiento terapéutico

**Gianluca Pasini** — *Entrenador de fuerza y potencia | Co-fundador*
Entrenador especializado en fuerza y potencia, con más de 10 años de experiencia en entrenamiento deportivo y 4 como preparador físico de un equipo de rugby de primera división. Ex jugador de la selección uruguaya de rugby, representó al país en un mundial: conoce desde adentro lo que exige el deporte de elite y lo que significa volver a competir después de una lesión. Hoy también planifica preparación física a online para futbolistas profesionales en Europa. En MOVE dirige el área de entrenamiento, donde trabaja con planificación individualizada, control de cargas y progresión medida —el mismo criterio del alto rendimiento— tanto con atletas como con personas que entrenan para sentirse mejor. Es quien toma el trabajo donde termina la rehabilitación y lo lleva hasta el rendimiento.
Especialidades: Fuerza y potencia · Readaptación deportiva · Alto rendimiento · Planificación individualizada

**Leandro Olenchuk** — *Entrenador*
Técnico en Fitness, actualmente cursando el último año de la Licenciatura en Educación Física. Siete años de experiencia en el área de entrenamiento, con formación específica en preparación física para deportes de equipo, y dos años como preparador físico de un equipo de fútbol de la Liga Montevideana. En MOVE está a cargo del acompañamiento en sala: supervisa la técnica, controla las cargas y asegura que cada persona ejecute su plan como fue diseñado, tanto de entrenamiento como de readaptación deportiva.
Especialidades: Fuerza y velocidad · Deportes de equipo · Entrenamiento en sala

**Recovery Room by MOVE.** "Un concepto nuevo en Uruguay: un espacio diseñado para optimizar la recuperación física y mental, combinando distintas tecnologías y estrategias basadas en evidencia para ayudar al cuerpo a recuperarse mejor. Cada herramienta actúa sobre un mecanismo diferente; juntas crean el entorno ideal para favorecer la recuperación, disminuir la fatiga, regular el sistema nervioso y ayudarte a sentirte y rendir mejor."

| Equipo | Descripción |
|---|---|
| Botas de presoterapia | Compresión secuencial que favorece el retorno venoso y linfático y reduce la sensación de piernas cargadas. |
| Luz roja e infrarroja | Fotobiomodulación para acompañar la recuperación muscular y celular. |
| Sauna infrarrojo | Calor infrarrojo que ayuda a relajar la musculatura y a la termorregulación. |
| Meditación y respiración | Prácticas guiadas para bajar revoluciones y regular el sistema nervioso. |
| Sillón de gravedad cero | Posición que descarga la columna y las piernas para un descanso profundo. |

**Contacto (semilla de la pestaña Contacto).** Dirección: Máximo Tajes 6397 esquina Beranger. Horarios: Lunes a viernes · 7:00 – 11:00 · 15:00 – 20:00. WhatsApp: +598 99 140 299. Instagram: @move_strengthconditioning. Maps: `https://www.google.com/maps/place/MOVE+Strength%26Conditioning/@-34.8773036,-56.0787995,17z/data=!4m6!3m5!1s0x959f8730c171b183:0x6e7a19d4869b4b26!8m2!3d-34.8773036!4d-56.0787995!16s%2Fg%2F11g22zyvcy`
