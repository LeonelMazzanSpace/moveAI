# Runbook de deploy — MOVE

Guía para publicar MOVE cuando existan los accesos a Neon, AWS (Elastic Beanstalk), Vercel y los proveedores. Hasta entonces nada de esto se ejecutó: el desarrollo corre con Postgres en Docker, el simulador de pagos y el email en modo dry-run (ver [development.md](development.md)). La guía paso a paso de cada consola (Neon, AWS, Vercel, DNS, Mercado Pago, Google, Brevo y Bitbucket), con los links a la documentación oficial, está en la parte 4 del [manual de usuario](manual/manual-de-usuario.md#parte-4-proveedores-uno-por-uno); este runbook tiene los comandos.

Arquitectura de producción:

| Pieza | Plataforma | Notas |
|---|---|---|
| Web (`apps/web`) | Vercel | Preview por rama, producción desde el repositorio |
| API (`apps/api`) | AWS Elastic Beanstalk (Node 24) | Zip generado por `scripts/package-api-eb.sh` |
| Base de datos | Neon (PostgreSQL 17) | Base nueva; no se migra el esquema anterior. Sin RDS en el MVP |
| Pagos | Mercado Pago | Credenciales de producción y webhook firmado |
| Email | Brevo | Remitente verificado |

Los ambientes de desarrollo y producción están separados: bases, credenciales y URLs distintas (en el manual: [manual de usuario](manual/manual-de-usuario.md#ambientes-separados-de-desarrollo-y-producción)). Los previews de Vercel apuntan a la API de desarrollo, nunca a la de producción (ver [Vercel](#4-web-en-vercel)). Los dominios de este runbook (`move.uy`) son ejemplos: el dominio final no está decidido (el sitio actual de MOVE está en `moveperformance.uy`).

El CI (`bitbucket-pipelines.yml`) solo valida (lint, tests, e2e de la API y build). No hay pasos de deploy: se hace a mano siguiendo este runbook hasta que se automatice.

## Variables de entorno de la API

Se definen y validan en `apps/api/src/config/env.validation.ts`; si falta una obligatoria, la API no arranca. En Elastic Beanstalk se cargan en *Configuration → Updates, monitoring, and logging → Runtime environment variables* (o con `eb setenv`); los secretos pueden venir de Secrets Manager o SSM Parameter Store. Los valores sensibles no van al repositorio.

| Variable | Producción | Propósito |
|---|---|---|
| `NODE_ENV` | Obligatoria (`production`) | Con `production` se exigen las credenciales de proveedores, se usan cookies `Secure` y se deshabilita el simulador de pagos |
| `PORT` | Obligatoria | Puerto donde escucha la API. Definirlo siempre como propiedad del entorno (por ejemplo `8080`): Beanstalk configura Nginx para reenviar a ese puerto; sin la propiedad, Nginx reenvía al 5000. Solo dígitos |
| `WEB_URL` | Obligatoria | Origen exacto de la web, sin barra final (`https://move.uy`). Se usa para CORS, orígenes de confianza de Better Auth y links de los emails |
| `API_PUBLIC_URL` | Obligatoria | URL pública de la API sin `/api` (`https://api.move.uy`). Base de Better Auth, callback de Google y `notification_url` del webhook de Mercado Pago |
| `DB_HOST` | Obligatoria | Host de Neon. Usar el host **directo** (sin `-pooler`): los jobs usan locks de sesión de Postgres, que un pooler en modo transacción rompe |
| `DB_PORT` | Obligatoria | `5432` |
| `DB_USER` | Obligatoria | Usuario de la base en Neon |
| `DB_PASSWORD` | Obligatoria | Contraseña de la base en Neon |
| `DB_NAME` | Obligatoria | Nombre de la base nueva de MOVE en Neon |
| `DB_SSL` | Obligatoria en la práctica (`true`) | Neon exige SSL. El default local es `false`; si falta en producción la conexión falla. Escribir exactamente `true`: `1` pasa la validación pero no activa SSL |
| `BETTER_AUTH_SECRET` | Obligatoria | Secreto de Better Auth, 32+ caracteres aleatorios (por ejemplo `openssl rand -base64 48`). Cambiarlo invalida las sesiones |
| `COOKIE_DOMAIN` | Obligatoria en la práctica (`.move.uy`) | Dominio raíz de la cookie de sesión, para que web y API compartan la sesión. Vacío deja la cookie atada al host de la API |
| `GOOGLE_CLIENT_ID` | Opcional | Cliente OAuth de Google. Va junto con `GOOGLE_CLIENT_SECRET`: se definen las dos o ninguna |
| `GOOGLE_CLIENT_SECRET` | Opcional | Secreto del cliente OAuth de Google |
| `MP_ACCESS_TOKEN` | Obligatoria | Access token de Mercado Pago. Sin él (fuera de producción) se usa el simulador |
| `MP_WEBHOOK_SECRET` | Obligatoria | Secreto de firma de los webhooks de Mercado Pago; sin firma válida el webhook responde 401 |
| `BREVO_API_KEY` | Obligatoria | API key de Brevo. Sin ella (fuera de producción) los emails se registran en el log y no se envían |
| `BREVO_SENDER_EMAIL` | Obligatoria | Remitente verificado en Brevo (debe ser un email válido) |
| `BREVO_SENDER_NAME` | Opcional | Nombre del remitente (default `MOVE`) |
| `SCHEDULER_ENABLED` | Opcional | Solo `true` o `false`; cualquier otro valor impide el arranque. Default `true`. Ver [Scheduler](#scheduler-una-sola-instancia) |
| `TRUST_PROXY_HOPS` | Obligatoria en la práctica (`2`) | Cantidad de proxies delante de la API cuya entrada de `X-Forwarded-For` se acepta para obtener la IP real del cliente (un solo dígito de 0 a 5; cualquier otro valor, como `-1`, `6`, `2.0` o `0x2`, impide el arranque). Default `0`: se ignora el header y todas las requests parecen venir del proxy, así que el límite de checkout por IP se comparte entre todos los clientes. Detrás del ALB + Nginx de Beanstalk va `2`. No existe la opción `true`: confiaría en todo el header, que el cliente puede escribir, y cualquiera podría saltar el límite cambiando su IP. Ver [Proxy e IP del cliente](#proxy-ip-del-cliente-y-límites-de-checkout) |

Variables que **no** van a producción: `E2E_DATABASE_NAME` (solo tests) y `CREATE_STAFF_PASSWORD` (solo se pasa al comando `user:create-staff`, ver [paso 7](#7-crear-el-primer-staff)).

### Variables de la web (Vercel)

| Variable | Producción | Propósito |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Obligatoria | URL de la API con `/api` (`https://api.move.uy/api`). Se incrusta en el build: cambiarla requiere un nuevo deploy |
| `NEXT_PUBLIC_GOOGLE_ENABLED` | Opcional | `true` muestra el botón de Google; solo activar si la API tiene `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` |

## 1. Base de datos en Neon

1. En el proyecto Neon existente de MOVE (o uno nuevo con Postgres 17), crear una **base nueva** (por ejemplo `move`) con un rol propio como dueño. No reutilizar ni migrar el esquema anterior. Desarrollo va en otro branch (`development`, sin borrado automático) con **otro rol y otra base**: un branch hereda los roles y las contraseñas del padre (salvo que el padre sea un *protected branch*: entonces Neon genera contraseñas nuevas para el hijo).
2. Copiar host directo (en **Connect**, con *Connection pooling* apagado), usuario, contraseña y nombre a las variables `DB_*` y definir `DB_SSL=true`.
3. Las migraciones se corren **antes** de cambiar el tráfico a la versión nueva, desde el mismo bundle que se va a desplegar (el bundle no incluye el CLI de Nest, por eso se llama a TypeORM directo):

   ```bash
   unzip artifacts/move-api-<sha>.zip -d /tmp/move-api && cd /tmp/move-api
   DB_HOST=… DB_PORT=5432 DB_USER=… DB_PASSWORD=… DB_NAME=… DB_SSL=true \
     node_modules/.bin/typeorm migration:run -d dist/database/data-source.js
   ```

   Pasar las variables en el comando (o exportarlas en la sesión) en lugar de crear un `.env`. El esquema solo cambia por migraciones: nunca `synchronize`.
4. Cargar los datos iniciales (planes, plantillas de horarios y configuración, valores provisorios hasta que MOVE los confirme). Es idempotente:

   ```bash
   DB_HOST=… DB_PORT=5432 DB_USER=… DB_PASSWORD=… DB_NAME=… DB_SSL=true node dist/database/seed.js
   ```

## 2. API en Elastic Beanstalk

1. Generar el paquete desde la raíz del repo (necesita `pnpm`, `zip` y el commit a desplegar en `HEAD`):

   ```bash
   bash scripts/package-api-eb.sh      # genera artifacts/move-api-<sha>.zip
   ```

   El zip contiene `Procfile` (`web: node dist/main.js`), `package.json`, `dist/` y los `node_modules` de producción. No lleva `.env` ni código fuente. Como incluye `node_modules`, conviene generarlo en Linux (CI o Docker `node:24`) si en algún momento se suman dependencias con binarios nativos; hoy las dependencias de runtime son JavaScript puro.
2. Crear el entorno con la plataforma **Node.js 24** (Amazon Linux 2023), tipo *Web server environment*, con **Application Load Balancer** (el tipo de balanceador no se puede cambiar después) y capacidad de 1 instancia. Roles de IAM, etiquetas `Project`/`Environment`/`Owner` y logs en CloudWatch con retención: ver la sección AWS del manual.
3. Cargar todas las variables de la [tabla](#variables-de-entorno-de-la-api) como propiedades del entorno.
4. Subir el zip como nueva versión de la aplicación y desplegarla. Beanstalk usa el `Procfile` para arrancar y, al venir `node_modules` en el zip, no instala dependencias.
5. Configurar el health check del balanceador en `GET /api/health` (*Load balancer → Processes → default → Health check path*, u opción `HealthCheckPath` de `aws:elasticbeanstalk:environment:process:default`). Responde `{"status":"ok"}`.
6. **Proxy y límite de body de auth.** `/api/auth/*` rechaza con 413 cualquier request con más de 64 KB o con `Transfer-Encoding` sin `content-length`. El proxy (Nginx de Beanstalk o ALB) tiene que reenviar `content-length`: dejar `proxy_request_buffering on` (el default de Nginx) y no agregar configuración que lo desactive. Los `fetch` del navegador con body JSON siempre envían `content-length`.
7. Subir con HTTPS (certificado en ACM asociado al balanceador) y dominio `api.move.uy`.

### Scheduler: una sola instancia

La API corre jobs con cron dentro del proceso (`@nestjs/schedule`): vencimiento de reservas retenidas (cada minuto), conciliación de pagos (cada 10 minutos), generación de turnos (03:00), detección de seguimiento (07:00), recordatorios de vencimiento (09:00) y check-ins mensuales (10:00, actúan el primer lunes del mes); las horas son de `America/Montevideo`. Cada job toma un lock de Postgres, así que dos instancias no corren el mismo job a la vez, pero igual:

- Dejar el entorno con **una sola instancia**, o
- Si se escala a varias, poner `SCHEDULER_ENABLED=true` en **una** y `SCHEDULER_ENABLED=false` en todas las demás (solo se aceptan esos dos valores).

`SCHEDULER_ENABLED=false` solo apaga los crons; los endpoints y la corrida manual (`POST /api/staff/automations/run/:job`) siguen funcionando.

### Proxy, IP del cliente y límites de checkout

Iniciar un checkout está limitado por IP: `POST /api/checkout/booking` y `POST /api/checkout/plan` aceptan 10 requests por minuto, y `POST /api/checkout/booking` (el único que admite invitados) además 20 por hora. Al pasarse responden 429 `RATE_LIMITED`.

- **IP real.** En Beanstalk la request pasa por el ALB y por el Nginx de la instancia, así que la API la recibe desde `127.0.0.1` con `X-Forwarded-For: <cliente>, <IP del ALB>`. Con `TRUST_PROXY_HOPS=2` la API toma la IP del cliente y descarta lo que el cliente haya agregado antes en el header. Si se cambia la topología (por ejemplo, se quita Nginx o se agrega CloudFront), ajustar el valor a la cantidad de proxies propios delante de la API. Un valor mayor que la cantidad real de proxies deja que el cliente elija su IP (igual que `true`); uno menor hace que todos los clientes compartan un mismo contador. Después de cualquier cambio de topología, repetir el ítem "IP real detrás del proxy" del [checklist](#8-checklist-de-verificación-posterior-al-deploy). Nunca usar `true`.
- **Contadores en memoria por instancia.** El throttler guarda los contadores en la memoria del proceso: se pierden al reiniciar y no se comparten entre instancias. Con N instancias detrás del balanceador, el límite efectivo por IP es hasta N × el límite (con 2 instancias, hasta 20 por minuto y 40 por hora). Para un límite global hay que mover el storage del throttler a un almacén compartido (por ejemplo Redis), que el MVP no tiene.
- Clientes que salen a internet con la misma IP pública (por ejemplo, el wifi del gimnasio) comparten los contadores.

## 3. Dominios

Web y API van bajo el mismo dominio raíz para que la cookie de sesión sea first-party:

| Servicio | Dominio de ejemplo |
|---|---|
| Web (Vercel) | `move.uy` |
| API (Elastic Beanstalk) | `api.move.uy` |
| Web y API de desarrollo | Otro dominio registrable: `<dominio-dev>` y `api.<dominio-dev>`, con `COOKIE_DOMAIN=.<dominio-dev>` (ver [Vercel](#4-web-en-vercel), paso 4) |

- `COOKIE_DOMAIN=.move.uy` (con el punto inicial), `WEB_URL=https://move.uy`, `API_PUBLIC_URL=https://api.move.uy`, `NEXT_PUBLIC_API_URL=https://api.move.uy/api`.
- `api.move.uy`: registro CNAME hacia el entorno de Beanstalk (o alias al balanceador) con certificado HTTPS.
- `move.uy`: los registros que indique Vercel al agregar el dominio al proyecto.

## 4. Web en Vercel

1. Importar el repositorio en el proyecto existente de MOVE en Vercel con **Root Directory** `apps/web` (framework Next.js; Vercel detecta pnpm por `packageManager`) y Node 24.
2. Definir `NEXT_PUBLIC_API_URL` y, si corresponde, `NEXT_PUBLIC_GOOGLE_ENABLED` en el ambiente *Production*.
3. Producción se publica desde la rama `main`; las demás ramas generan previews.
4. En el ambiente *Preview* definir `NEXT_PUBLIC_API_URL` apuntando a la API de **desarrollo**. Cada API solo acepta (CORS y cookies) el origen de su `WEB_URL`: los previews con URL automática (`*.vercel.app`) sirven para mirar páginas, y los flujos completos de desarrollo se prueban en un dominio fijo asignado a la rama de desarrollo. Ese dominio tiene que ser **otro dominio registrable** (`<dominio-dev>`, con la API en `api.<dominio-dev>` y `COOKIE_DOMAIN=.<dominio-dev>`), no un subdominio de producción: con `dev.move.uy`, la cookie de sesión de producción (`.move.uy`, también la del staff) llegaría al código de desarrollo, y `dev.move.uy` sería el mismo sitio que `api.move.uy`, así que `SameSite=Lax` no frenaría un formulario de desarrollo contra la API de producción. Si igual se elige un subdominio, es una decisión abierta con riesgo aceptado y los perfiles de navegador separados son obligatorios (ver [Ambientes separados](manual/manual-de-usuario.md#ambientes-separados-de-desarrollo-y-producción)).
5. Agregar el dominio `move.uy` al proyecto.

## 5. Servicios externos

### Google OAuth (opcional)

1. En Google Cloud Console crear un cliente OAuth tipo *Web application*.
2. Orígenes autorizados: `https://move.uy`. URI de redirección autorizada: `https://<api>/api/auth/callback/google` (por ejemplo `https://api.move.uy/api/auth/callback/google`).
3. Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en la API y `NEXT_PUBLIC_GOOGLE_ENABLED=true` en Vercel. Una cuenta por email: Google se vincula a la cuenta que ya exista con ese email.

### Mercado Pago

1. Primero probar de punta a punta con las **credenciales de prueba** (usuarios y tarjetas de prueba) en el ambiente de **desarrollo**; recién después cambiar a las credenciales de producción. Los pagos con credenciales de prueba pueden no generar avisos: en desarrollo la firma se prueba con **Webhooks → Simular** del panel, y el pago entra por la conciliación (compras pendientes con más de `reconcileAfterMinutes`, cada 10 minutos), así que el plan puede tardar hasta unos 20 minutos en activarse. Si en producción un pago tarda eso, revisar `API_PUBLIC_URL` (arma la `notification_url` de cada preferencia, que tiene prioridad sobre la URL del panel) y el historial de notificaciones de la aplicación.
2. Cargar `MP_ACCESS_TOKEN` con el access token de la aplicación.
3. En *Tus integraciones → Webhooks*, configurar la URL `https://<api>/api/payments/webhook/mercadopago` con el evento de pagos y copiar la clave secreta a `MP_WEBHOOK_SECRET`.
4. La API verifica la firma de cada notificación con formato Webhooks (firma inválida: 401 sin efectos) y es idempotente: repetir una notificación, o recibirla además por la conciliación, no duplica la suscripción ni extiende la vigencia dos veces.
5. Cada preferencia lleva su propia `notification_url`, que tiene prioridad sobre la URL del panel. Mientras sea así (decisión abierta D68, ver [el manual](manual/manual-de-usuario.md#decisión-d68-avisos-de-mercado-pago)):
   - Los avisos con formato **IPN** (`?topic=…&id=…`) que Mercado Pago mande a esa URL no se pueden firmar y la API los responde **401**: es esperado y sin efectos. **No restablecer `MP_WEBHOOK_SECRET` por eso**: rompería los avisos firmados.
   - Mercado Pago no documenta si los avisos con formato Webhooks enviados a la `notification_url` de una preferencia traen un `x-signature` válido: confirmarlo con el primer pago real.
   - D68: antes de producción elegir entre (a) responder 200 sin efectos a los avisos IPN o que no sean de pagos antes de verificar la firma, o (b) quitar la `notification_url` de las preferencias y usar la URL del panel con una aplicación de Mercado Pago por ambiente (cada ambiente con su clave secreta). Recomendada: (b), confirmada con un pago real.
6. Comportamiento a conocer: los pagos de plan rechazados quedan en `pending` (el cliente puede reintentar); la conciliación periódica también revisa las compras vencidas (`expired`) de cualquier tipo, de plan o de reserva, de los últimos 7 días, porque su preferencia todavía puede pagarse tarde (D60). Si un pago se aprueba cuando la reserva ya venció y el turno no tiene cupo, la compra queda aprobada y marcada para atención del staff (sin reembolso automático).

### Brevo

1. Verificar el dominio o el remitente en Brevo y crear una API key.
2. Cargar `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (el remitente verificado) y, si se quiere, `BREVO_SENDER_NAME`.
3. Sin `BREVO_API_KEY` la API no envía nada: registra el envío en el log (dry-run). En producción la variable es obligatoria.
4. Brevo puede activar solo el bloqueo de IPs desconocidas para las API keys; como la IP de salida de una instancia de Beanstalk cambia al reemplazarla, desactivar ese bloqueo para la API o darle a la API una IP de salida fija (detalle en la sección Brevo del manual).

## 6. Autenticación detrás de proxy

- Better Auth revoca todas las sesiones de una cuenta cuando se restablece su contraseña, y marca el email como verificado al completar un restablecimiento o una invitación (alta de cliente por el staff). No se exige email verificado para ingresar.
- Las cookies de sesión son `Secure` en producción: probar siempre sobre HTTPS.

## 7. Crear el primer staff

Con las variables `DB_*` del entorno de producción y la contraseña por variable (no por argumento, para que no quede en el historial del shell):

```bash
cd /tmp/move-api   # el bundle descomprimido del paso 1
read -rs CREATE_STAFF_PASSWORD && export CREATE_STAFF_PASSWORD
DB_HOST=… DB_PORT=5432 DB_USER=… DB_PASSWORD=… DB_NAME=… DB_SSL=true \
BETTER_AUTH_SECRET=… NODE_ENV=production PORT=8080 \
WEB_URL=https://move.uy API_PUBLIC_URL=https://api.move.uy \
MP_ACCESS_TOKEN=… MP_WEBHOOK_SECRET=… BREVO_API_KEY=… BREVO_SENDER_EMAIL=… SCHEDULER_ENABLED=false \
  node dist/cli/create-staff.js --email <email> --name "<Nombre Apellido>"
unset CREATE_STAFF_PASSWORD
```

El comando arranca el contexto de la aplicación, por eso necesita el mismo conjunto de variables que la API (con `SCHEDULER_ENABLED=false` para que no corran jobs). Imprime solo el id (`staff <id>`). Después, entrar a la web con ese usuario y cambiar la contraseña si se usó una temporal.

Si ya existe una cuenta con ese email, el comando la rechaza y termina con error. Para convertir esa cuenta en staff hay que repetirlo agregando `--promote-existing`: la cuenta queda con la contraseña dada, se cierran todas sus sesiones, el email queda verificado y el comando avisa que reutilizó la cuenta existente. `--name` sigue siendo obligatorio, pero solo se usa al crear una cuenta nueva: con `--promote-existing` el nombre de la cuenta existente no cambia.

```bash
# mismas variables que arriba
  node dist/cli/create-staff.js --email <email> --name "<Nombre Apellido>" --promote-existing
```

## 8. Checklist de verificación posterior al deploy

- [ ] `GET https://<api>/api/health` responde `200` y `{"status":"ok"}`.
- [ ] La web carga en `https://move.uy` y la lista de planes viene de la API (sin errores de CORS en la consola).
- [ ] Registro de un cliente nuevo y login: la cookie de sesión queda con `Secure` y dominio `.move.uy`; recargar mantiene la sesión.
- [ ] `POST /api/auth/sign-in/email` con un body JSON normal no responde 413 (el proxy reenvía `content-length`).
- [ ] `GET /api/staff/dashboard` responde 401 sin sesión y 403 con la sesión de un cliente.
- [ ] IP real detrás del proxy (`TRUST_PROXY_HOPS=2`): desde una red, 11 `POST /api/checkout/booking` seguidos con ids inexistentes (`{"planId":"<uuid>","timeSlotId":"<uuid>","guest":{…}}`): los primeros 10 dan 404 y el 11.º 429; agregar `-H 'X-Forwarded-For: 1.2.3.4'` no lo evita; y en el mismo minuto, desde otra red (por ejemplo datos móviles) la primera request da 404, no 429.
- [ ] Ingreso del staff y apertura de Dashboard, Clientes y Configuración.
- [ ] Pago de prueba: compra de un plan con credenciales de prueba de Mercado Pago hasta ver la suscripción activa.
- [ ] Webhook: en desarrollo, **Webhooks → Simular** a la URL de pruebas responde 200 (o 502 con un id inventado; nunca 401). En producción, con el primer pago real, en el log aparece `webhook payment=<id>` y la compra pasa a aprobada sin esperar la conciliación; si solo hay 401, resolver D68 antes de seguir. Los 401 a avisos IPN (`?topic=…`) son esperados. Reenviar la notificación desde el panel de Mercado Pago no duplica nada.
- [ ] Email recibido: restablecer la contraseña de una cuenta de prueba y recibir el correo de Brevo (o ver el envío en el panel de Brevo).
- [ ] Cron ejecutado en los logs: aparecen líneas `job expire-holds …` y `job reconcile-payments …` (corren solas) y, tras `POST /api/staff/automations/run/followup-detect`, la línea `job followup-detect …`. Con varias instancias, comprobar que solo una registra los jobs.
- [ ] Neon: las tablas existen en la base nueva y la conexión usa SSL.
- [ ] Reemplazar los valores provisorios de Configuración (aviso "Valores provisorios — confirmar con MOVE") con los que defina MOVE.

## 9. Rollback

- API: volver a desplegar la versión anterior del zip desde Beanstalk. Las migraciones no se revierten automáticamente; si una migración nueva no es compatible hacia atrás, revertirla con `node_modules/.bin/typeorm migration:revert -d dist/database/data-source.js` (del bundle nuevo) **antes** de volver a la versión anterior.
- Web: *Instant Rollback* sobre un deploy anterior en Vercel.
