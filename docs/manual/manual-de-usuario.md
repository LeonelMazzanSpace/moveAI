# MOVE — Manual de usuario

Plataforma de **Performance, Rehab y Recovery** de MOVE (Uruguay): registro, planes, pagos, reservas, asistencia, seguimiento y renovación en un solo lugar.

Este manual tiene tres partes y una captura de cada pantalla:

1. [Parte 1: Clientes](#parte-1-clientes): cómo usar el sitio, contratar un plan y reservar.
2. [Parte 2: Staff de MOVE](#parte-2-staff-de-move): el panel de gestión (clientes, turnos, pagos, seguimiento y configuración).
3. [Parte 3: Equipo técnico](#parte-3-equipo-técnico): cómo correr todo en una computadora, qué está simulado hoy y qué falta para publicarlo.

> **Sobre los datos de las capturas.** Todas las imágenes salen de una base de demostración con personas, emails y teléfonos **inventados** (emails `@example.com`), cargada el 13/10/2026. Los planes, precios, horarios y umbrales que se ven son **provisorios** hasta que MOVE los confirme (ver [Reglas y valores provisorios](#reglas-y-valores-provisorios)). Hoy no hay una versión publicada: todo corre localmente (ver la Parte 3).

---

## Parte 1: Clientes

### Sitio público

No hace falta tener cuenta para mirar el sitio. La barra de arriba tiene **Inicio**, **Performance**, **Rehab**, **Recovery** y **Planes**, el botón **Ingresar** y el botón **Reservar**.

#### Inicio

Presenta los tres servicios de MOVE y lleva a **Ver planes** o a **Reservar Recovery**.

![Inicio](img/01-inicio.png)

#### Performance

Entrenamiento semi personalizado por reserva, sin límite semanal de asistencias mientras tu plan esté vigente. La página muestra los planes y, más abajo, la sección **Horarios y cupos**.

![Performance](img/02-performance.png)

En **Horarios y cupos** elegís el día y ves cada horario con su cupo en tiempo real (por ejemplo, `5 / 14 cupos`). Para reservar necesitás un plan vigente; si tu plan venció, la plataforma bloquea nuevas reservas y te lleva a renovar.

![Performance: horarios y cupos](img/03-performance-horarios.png)

#### Rehab

La **Evaluación y Diagnóstico** es la puerta de entrada a fisioterapia. Está abierta a alumnos y a personas externas: si todavía no tenés cuenta, se crea durante el proceso. El tratamiento posterior lo define el equipo de MOVE después de la evaluación.

![Rehab](img/04-rehab.png)

La reserva tiene cuatro pasos: **Evaluación → Fecha y horario → Pago → Confirmación**. Elegís el día y el horario, y el panel **Tu reserva** muestra el resumen y el total.

![Rehab: elegir fecha y horario](img/05-rehab-reserva.png)

#### Recovery

Recovery Room by MOVE está abierta a todo público, sin plan previo. Podés pagar una **sesión individual** o contratar un **paquete** de 4 u 8 sesiones.

![Recovery](img/06-recovery.png)

En **Reservá tu sesión** elegís la modalidad (**Sesión individual** o **Paquete**), el día y el horario. La sesión individual se paga en el momento y se puede reservar sin tener cuenta. Los paquetes duran 30 días desde la compra y las sesiones que no uses vencen al final.

![Recovery: reservar una sesión](img/07-recovery-reserva.png)

#### Planes

Compará los planes de Performance (Mensual, Trimestral, Semestral) y de Recovery. Con los botones **Todos / Performance / Recovery** filtrás por servicio. Los precios están en pesos uruguayos.

![Planes](img/08-planes.png)

![Planes de Recovery](img/09-planes-recovery.png)

| Plan | Precio provisorio | Detalle |
|---|---|---|
| Plan Mensual (Performance) | $ 3.900 | 1 mes, asistencias ilimitadas con reserva |
| Plan Trimestral (Performance) | $ 10.500 | 3 meses |
| Plan Semestral (Performance) | $ 19.800 | 6 meses |
| Evaluación y Diagnóstico (Rehab) | $ 1.800 | 60 minutos |
| Sesión individual (Recovery) | $ 900 | 45 minutos |
| Paquete 4 sesiones (Recovery) | $ 3.200 | 4 sesiones en 30 días |
| Paquete 8 sesiones (Recovery) | $ 5.900 | 8 sesiones en 30 días |

#### Reservar

**Reservar** te pregunta qué querés reservar: Performance, Rehab o Recovery. Cada tarjeta lleva a su pantalla. Sin sesión iniciada es la misma pantalla; con sesión, el botón de la barra pasa a **Mi perfil**.

![Reservar (sin sesión)](img/10-reservar-sin-sesion.png)

![Reservar (con sesión iniciada)](img/11-reservar.png)

### Registro e ingreso

#### Ingresar y crear cuenta

La pantalla de acceso tiene dos pestañas: **Iniciar sesión** (email y contraseña) y **Crear cuenta**. Para crear la cuenta completás nombre y apellido, email, teléfono (opcional) y una contraseña de al menos 8 caracteres. No hace falta confirmar el email para ingresar. Hay una sola cuenta por email.

![Ingresar](img/12-ingresar.png)

![Crear cuenta](img/13-registro.png)

Si querés reservar Rehab o Recovery sin ser alumno, no hace falta registrarte antes: la cuenta se crea durante el proceso de reserva. Si ya tenés una cuenta con ese email, la plataforma te avisa "Ya tenés una cuenta con ese email: ingresá para continuar" y te pide **ingresar** (así nadie reserva a nombre de otra persona). Al ingresar volvés a la pantalla de reserva y elegís el horario de nuevo, ahora con tu cuenta: no queda ninguna reserva a medias.

**Volvés a donde estabas.** Si te piden ingresar cuando querías abrir una página (por ejemplo, el checkout de un plan o tu historial), después de ingresar la plataforma te lleva a **esa misma página**, con su dirección exacta, y no al inicio de tu perfil. Solo se vuelve a páginas internas permitidas para tu tipo de cuenta: un cliente nunca termina en el panel de staff, ni al revés.

> El botón de ingreso con Google está oculto: Google es una integración pendiente (ver la Parte 3). Cuando esté activo, si intentás entrar con Google con un email que ya tiene una cuenta con contraseña, la pantalla de ingreso muestra **"Ya tenés una cuenta con ese email. Ingresá con tu contraseña."**: ingresá con tu contraseña.

#### Recuperar y restablecer la contraseña

Desde **¿Olvidaste tu contraseña?** ingresás tu email y recibís un link para elegir una contraseña nueva.

![Recuperar contraseña](img/14-recuperar.png)

El link abre la pantalla **Nueva contraseña**. Si el link está vencido o no es válido (como en la captura, que se abrió sin link), podés **Pedir un link nuevo**. Al restablecer, se cierran las sesiones abiertas de esa cuenta.

![Nueva contraseña (link no válido)](img/15-restablecer.png)

#### Continuar

Después de ingresar, la plataforma te lleva sola al lugar correcto: los clientes a **Mi perfil** y el staff al panel. Si abrís la pantalla sin sesión activa, ves el aviso "Tu sesión no está activa" con el enlace **Ingresar**.

![Continuar (sin sesión)](img/16-continuar.png)

### Contratar un plan

Para contratar un plan de Performance o un paquete de Recovery tenés que haber ingresado. Desde **Planes** o desde tu perfil, tocá **Contratar**: ves el resumen (precio, período o sesiones) y **Pagar con Mercado Pago**.

![Checkout del plan](img/22-checkout-plan.png)

Si renovás antes de que venza tu plan, el nuevo período empieza el día siguiente al vencimiento (no perdés días). En el ambiente de desarrollo, en lugar de Mercado Pago aparece un **simulador de pagos** donde se aprueba o se rechaza la operación; en producción lo reemplaza Mercado Pago.

![Simulador de pagos (solo desarrollo)](img/23-checkout-simulado.png)

Cuando el pago se aprueba, ves el resultado y podés ir a tu perfil: el plan queda activo en el momento.

![Resultado del pago](img/24-checkout-resultado.png)

Si el pago de un plan sigue pendiente después de la espera (por ejemplo, porque Mercado Pago tarda en acreditarlo), la pantalla te muestra "Confirmando tu pago" mientras espera y, pasado un minuto aproximadamente, **"Pago en proceso"**: "Tu pago está en proceso. Te avisamos por email cuando se acredite." Debajo aparece **Intentar de nuevo**, que te lleva otra vez al checkout de ese plan para probar con otro medio de pago. Si el pago fue rechazado o no se completó, la pantalla muestra enseguida "Pago no completado" y el botón **Intentar de nuevo** también aparece ahí.

**Límites del checkout.** Para evitar abusos, cada persona puede tener como máximo **2 reservas pendientes de pago** a la vez: si intentás una tercera, ves "Ya tenés reservas pendientes de pago. Completá el pago o esperá a que venzan." (las retenidas vencen a los 15 minutos). Además, el checkout acepta hasta 10 intentos por minuto desde una misma conexión y, al reservar una sesión de Rehab o Recovery, hasta 20 intentos por hora desde esa misma conexión: si superás cualquiera de los dos límites, ves "Hiciste demasiados intentos. Esperá un rato y probá de nuevo."

### Mi perfil

Es tu pantalla principal. Muestra:

- **Tu plan de Performance** (estado Activo, Por vencer o Vencido), desde cuándo está vigente, cuándo vence, el progreso del período y el botón **Renovar plan**.
- **Paquetes Recovery**: cuántas sesiones te quedan y cuándo vence el paquete.
- **Próximas reservas**, cada una con su botón **Cancelar**. Una reserva que está retenida esperando el pago (por ejemplo, una evaluación de Rehab que todavía no pagaste) muestra el aviso **Pago pendiente**; si no se completa el pago a tiempo, la reserva se libera sola.
- **Reservar**: accesos directos a Performance y Recovery.
- **Avisos** (también desde la campana de arriba): plan por vencer o vencido, check-in pendiente o respondido y paquete con pocas sesiones.
- **Tu mes en MOVE**: asistencias del mes y veces por semana.

![Mi perfil](img/17-perfil.png)

**Reservar Performance.** Con un plan vigente, elegí el día y el horario en **Performance → Horarios y cupos** (o desde **Reservar**). Podés reservar hasta 14 días hacia adelante. Si el turno se llenó, la plataforma avisa que está completo; si no tenés plan vigente, avisa que necesitás uno.

**Cancelar.** Podés cancelar una reserva de tu plan de Performance, de tu paquete de Recovery o de seguimiento fisioterapéutico hasta **2 horas antes** del turno. Las reservas que pagaste individualmente (la Evaluación de Rehab y la sesión individual de Recovery) no se cancelan online: escribile a MOVE y el equipo las cancela.

**Reservar Rehab (evaluación).** Seguí los cuatro pasos de la pantalla de Rehab. Si todavía no tenés cuenta se crea en el proceso. El turno queda retenido mientras pagás (15 minutos); si no se completa el pago, el turno se libera.

**Reservar Recovery.** Con un paquete activo reservás tus sesiones eligiendo día y horario (se descuentan del paquete). Sin paquete, elegís sesión individual o contratás uno.

### Seguimiento fisioterapéutico

Después de la evaluación (o si el equipo te deriva a Rehab), el staff **habilita el seguimiento fisioterapéutico** en tu cuenta. Entonces podés reservar tus turnos de Rehab desde **Reservar → Fisioterapia**, con la disponibilidad del profesional, sin pago online.

![Reservar fisioterapia](img/19-reservar-fisioterapia.png)

Elegís el día y aparecen los horarios disponibles; confirmás con **Reservar**. Si tu cuenta no tiene el seguimiento habilitado, la plataforma te avisa que no está habilitado.

![Fisioterapia: horarios disponibles](img/20-reservar-fisioterapia-horarios.png)

### Historial

Lista tu actividad (reservas, pagos, asistencias, ausencias, no shows y cancelaciones), de la más reciente a la más antigua. Con **Todo / Reservas / Pagos** filtrás el tipo de movimiento.

![Historial](img/18-historial.png)

### Check-in mensual

Si tenés un plan de Performance vigente y no estás en pausa, una vez por mes recibís un email con el link al **check-in**: tres preguntas de un minuto (cómo te sentís con el entrenamiento, si sentiste alguna molestia y si cambiaron tus objetivos). Si contás una molestia o querés ajustar objetivos, el equipo lo ve y se comunica con vos.

![Check-in](img/21-check-in.png)

---

## Parte 2: Staff de MOVE

Ingresá desde **Ingresar** con tu usuario de staff: la plataforma te lleva al panel. La barra lateral tiene **Dashboard**, **Clientes**, **Turnos y asistencia**, **Pagos**, **Seguimiento** (con un número de alertas abiertas y el subitem **Check-in**) y **Configuración**. Los usuarios de staff los crea el equipo técnico (ver la Parte 3); los clientes no pueden entrar al panel.

### Dashboard

Resume el día: un aviso si hay turnos con asistencia pendiente de marcar, los números de clientes (activos, planes por vencer en los próximos 7 días, inactivos y asistencias de hoy), los contadores de **alertas abiertas** por tipo y la tabla **Turnos de hoy** con el enlace **Ver turno**.

![Dashboard](img/25-staff-dashboard.png)

### Clientes

La lista muestra a todos los clientes con su estado, plan, vencimiento, estado de pagos, última asistencia, frecuencia semanal y cantidad de turnos de Rehab y Recovery. Podés buscar por nombre, email o plan (sin importar mayúsculas ni tildes) y filtrar por estado: **Activos**, **Por vencer**, **Inactivos**, **Vencidos**, **Pausados** y **Sin plan**.

![Clientes](img/26-staff-clientes.png)

| Estado | Qué significa |
|---|---|
| Activo | Plan vigente y con asistencia reciente |
| Por vencer | El plan vence dentro del plazo de aviso (7 días, provisorio) |
| Vencido | El plan terminó y no se renovó |
| Inactivo | Plan vigente, pero lleva varios días sin asistir (según las reglas de seguimiento) |
| Pausa | Hay un motivo de inactividad registrado (lesión, vacaciones, etc.) |
| Sin plan | Tiene cuenta, pero nunca tuvo un plan de Performance |

#### Nuevo cliente

**Nuevo cliente** crea la cuenta con nombre, email y teléfono (opcional). El cliente recibe un email para definir su contraseña. Si el email ya existe, la plataforma avisa que ya hay una cuenta.

![Nuevo cliente](img/27-staff-clientes-nuevo.png)

#### Detalle del cliente

Al abrir un cliente ves su plan y paquetes, las **métricas** (frecuencia semanal, asistencias del mes, última asistencia, cancelaciones, no shows y turnos de Rehab y Recovery), los contactos que ya se hicieron, el historial y las próximas reservas. Desde acá también podés:

- **Habilitar el seguimiento fisioterapéutico**, con el interruptor de arriba a la derecha: el cliente podrá reservar turnos de Rehab desde su perfil.
- **Registrar un motivo** de inactividad (Lesión, Vacaciones, Pausa temporal, Falta de tiempo, Mudanza o Quiere volver más adelante), con una nota interna y, si querés, una fecha de re-contacto. Registrar un motivo **pausa** al cliente: no recibe alertas ni emails automáticos hasta que termine la pausa, y la plataforma te avisa el día de re-contacto.

![Detalle del cliente](img/28-staff-cliente-detalle.png)

### Turnos y asistencia

Elegí el día (con las flechas o el calendario) y el servicio (**Performance**, **Recovery** o **Fisioterapia**). Los botones de horario cambian de turno. Arriba se ve cuántas reservas tiene (`5/14`), cuántos presentes, cuántos ausentes y no shows y las cancelaciones; abajo, la lista de alumnos con su plan, su última asistencia y su estado.

![Turnos y asistencia](img/29-staff-turnos.png)

**Marcar asistencia.** Con los botones de cada alumno:

| Botón | Estado | Cuándo usarlo |
|---|---|---|
| **P** | Presente | Vino al turno |
| **A** | Ausente | No vino, pero avisó fuera de plazo |
| **NS** | No show | No vino y no avisó |

Ninguno tiene penalidad por ahora. Sin marcar, el alumno figura como **Pendiente** y el turno aparece en el aviso amarillo de "turno con asistencia pendiente". La asistencia se puede registrar una vez que el turno empezó. Con **Cancelar** el staff cancela la reserva de un alumno (por ejemplo, las que el cliente no puede cancelar online). El menú **⋯** del turno permite cambiar el cupo (nunca por debajo de las reservas activas) y cancelar el turno (solo si no tiene reservas activas).

> Solo los clientes reservan: el staff no reserva en nombre de un cliente; sí cancela y marca asistencia.

### Pagos

Lista las operaciones, de la más reciente a la más antigua, con cliente, ítem, servicio, monto, método (Mercado Pago, efectivo o transferencia) y estado. Filtrá por **Estado** (Aprobados, Pendientes, Rechazados, Expirados), por **Método** o con **Requieren atención**.

![Pagos](img/30-staff-pagos.png)

**Requieren atención** reúne las compras que quedaron aprobadas pero que el sistema no pudo completar sola: por ejemplo, si un pago se aprobó cuando la reserva retenida ya había vencido y el turno ya no tenía cupo. El staff las resuelve a mano (por ahora no hay reembolso automático).

#### Registrar un pago manual

**Registrar pago manual** sirve para cobros en efectivo o por transferencia. Buscá al cliente por nombre o email, elegí el plan, el método, el monto y, si querés, una nota. Al registrarlo, el plan o paquete **se activa en el momento**.

![Registrar pago manual](img/31-staff-pagos-manual.png)

### Seguimiento y check-ins

#### Alertas de seguimiento

Cada día la plataforma revisa a los clientes y abre alertas cuando algo requiere atención del equipo. Los filtros de arriba muestran cuántas hay de cada tipo:

| Alerta | Cuándo aparece (valores provisorios) |
|---|---|
| Por vencer | El plan vence en los próximos 7 días |
| Vencidos sin renovar | El plan terminó y no se renovó |
| 1 semana sin asistir | 7 días sin asistir |
| Inactividad prolongada | 21 días sin asistir |
| Baja de frecuencia | Promedio de las últimas 2 semanas menor al 50 % del de las 8 semanas anteriores |
| Re-contactar | Llegó la fecha de re-contacto de un cliente en pausa |
| Molestia reportada | El cliente contó una molestia en su check-in |
| Cambio de objetivos | El cliente quiere ajustar sus objetivos en su check-in |

Correr la detección dos veces el mismo día no duplica alertas. El botón **Ejecutar detección ahora** la corre en el momento.

![Seguimiento y retención](img/32-staff-seguimiento.png)

En cada alerta podés:

- **Contactar**: registrás el canal (Teléfono, WhatsApp, Email o En persona), el resultado (Habló con la persona, No respondió o Dejé un mensaje) y una nota. Queda en el historial del cliente.
- **Marcar gestionado**: cierra la alerta.
- **Registrar motivo**: pausa al cliente con un motivo de inactividad.
- **Ver historial**: abre el detalle del cliente.

![Contactar a un cliente](img/33-staff-seguimiento-contactar.png)

#### Check-in de clientes

El check-in mensual se envía por email el primer lunes de cada mes (10:00, hora de Montevideo) a los clientes con plan de Performance vigente que no estén en pausa; un cliente recibe como máximo uno por mes. Con **Enviar check-in** el staff lo puede enviar a mano.

La pantalla muestra a la izquierda la **vista previa** de lo que ve el alumno y, a la derecha, los números del mes (enviados, respondidos y que requieren intervención) y las respuestas. Si el cliente contó una molestia, la respuesta tiene **Derivar a Rehab**: habilita el seguimiento fisioterapéutico de ese cliente, marca como gestionada la alerta de molestia y le envía un email con el link para reservar su turno de Rehab.

![Check-in de clientes](img/34-staff-seguimiento-checkin.png)

### Configuración

La configuración tiene cuatro pestañas.

#### Planes

Alta, edición, desactivación y baja de los planes y paquetes de cada servicio (nombre, precio, período o sesiones, destacado).

![Configuración: planes](img/35-staff-configuracion-planes.png)

#### Horarios

Los turnos de Performance y Recovery se generan a partir de **horarios semanales** (día, hora, duración, cupo). **Nuevo horario** agrega uno, **Desactivar** deja de generar turnos con él (los ya generados quedan), **Generar turnos ahora** corre la generación y **Turno puntual** crea un turno suelto en una fecha. Un cambio en un horario solo afecta a los turnos que se generen después.

![Configuración: horarios](img/36-staff-configuracion-horarios.png)

#### Profesionales

Lista de profesionales de Rehab. Los turnos de Rehab son de un profesional y tienen cupo 1.

![Configuración: profesionales](img/37-staff-configuracion-profesionales.png)

#### Reglas y valores provisorios

Acá se editan los umbrales del sistema: horas para cancelar (2), días de reserva anticipada (14), minutos de reserva pendiente de pago (15), minutos para conciliar pagos (10), días para "por vencer" (7), días sin asistir (7), días de inactividad prolongada (21), ratio de baja de frecuencia (0,5), semanas recientes (2) y de referencia (8), y si se envía el check-in mensual.

![Configuración: reglas](img/38-staff-configuracion-reglas.png)

Mientras el aviso **"Valores provisorios — confirmar con MOVE"** esté visible, los planes, precios, horarios y umbrales son los del mockup y **no están confirmados**. Cuando MOVE los defina, se editan en estas pestañas y se tilda **Marcar los valores como confirmados**.

---

## Parte 3: Equipo técnico

### Qué hay hoy

MOVE es un monorepo con la web (Next.js) y la API (NestJS + PostgreSQL). **No hay ningún ambiente publicado**: todo corre en la máquina de desarrollo con Postgres en Docker. Hoy están **simulados**:

| Pieza | Estado actual | Qué hace en su lugar |
|---|---|---|
| Mercado Pago | Sin credenciales | Simulador de pagos (sin `MP_ACCESS_TOKEN`): el checkout lleva a una pantalla para aprobar o rechazar la compra. El simulador solo existe fuera de producción: con `NODE_ENV=production` la API ni siquiera lo monta (aunque `NODE_ENV` se defina solo en el `.env`) |
| Brevo (email) | Sin credenciales | Modo *dry-run*: no envía nada; cada email queda registrado en la tabla `email_logs` con estado `skipped` (y como línea de log con ids, sin datos personales) |
| Google OAuth | Sin credenciales | El botón de Google está oculto (`NEXT_PUBLIC_GOOGLE_ENABLED=false`): integración pendiente |
| Deploy | No existe | Solo el runbook [`docs/deploy.md`](../deploy.md) |

El pipeline de Bitbucket (`bitbucket-pipelines.yml`) solo valida (lint, tests, e2e de la API y build); no despliega.

### Correr todo en local, paso a paso

Requisitos: Node 24 (`nvm use` lee `.nvmrc`), pnpm 10 (`corepack enable`) y Docker.

1. **Instalar y configurar.** Desde la raíz del repo:

   ```bash
   pnpm install
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

   El `.env.example` de la API trae valores de desarrollo listos para usar (puertos por defecto: web 3000 y API 3001).

2. **Levantar Postgres, crear el esquema y cargar los datos iniciales.**

   ```bash
   pnpm db:up                                # Postgres 17 en Docker (contenedor move-postgres, puerto 5432)
   pnpm --filter @move/api migration:run     # crea el esquema
   pnpm --filter @move/api seed              # planes, horarios y configuración provisorios (idempotente)
   ```

3. **Crear el primer usuario de staff.** La contraseña va por variable de entorno, nunca por argumento:

   ```bash
   read -rs CREATE_STAFF_PASSWORD && export CREATE_STAFF_PASSWORD
   pnpm --filter @move/api user:create-staff -- --email staff@example.com --name "Nombre Apellido"
   unset CREATE_STAFF_PASSWORD
   ```

   El comando imprime solo el id. La contraseña debe tener al menos 8 caracteres. Si ya existe una cuenta con ese email, el comando **se niega** y avisa:

   ```text
   Ya existe una cuenta con ese email; usá --promote-existing para convertirla en staff.
   ```

   Con `--promote-existing` esa cuenta se convierte en staff, se le fija la contraseña indicada, se marca su email como verificado y se cierran todas sus sesiones abiertas; el comando avisa que reutilizó una cuenta existente.

   ```bash
   pnpm --filter @move/api user:create-staff -- --email persona@ejemplo.com --name "Nombre Apellido" --promote-existing
   ```

4. **Levantar la API y la web.**

   ```bash
   pnpm dev          # web en :3000 y API en :3001 (/api); GET /api/health debe responder {"status":"ok"}
   ```

   Al arrancar, la API genera los turnos de los próximos días a partir de los horarios del seed. Los jobs (vencimiento de reservas, conciliación de pagos, generación de turnos, detección de seguimiento, recordatorios y check-ins mensuales) corren dentro de la API; `SCHEDULER_ENABLED=false` los apaga.

5. **Probar.** Registrá un cliente en `http://localhost:3000/registro`, comprá un plan (el simulador de pagos aparece en el checkout), reservá y, con el usuario de staff, abrí `http://localhost:3000/staff`.

6. **Correr un job a mano** con sesión de staff: `POST /api/staff/automations/run/<job>` con `followup-detect`, `checkins-monthly`, `expiry-reminders`, `generate-slots`, `expire-holds` o `reconcile-payments`. Es idempotente y respeta el mismo lock que el cron.

7. **Tests.** `pnpm lint`, `pnpm test`, `pnpm build`; los e2e de la API necesitan `E2E_DATABASE_NAME` (ver [`docs/development.md`](../development.md#tests)).

Las variables de entorno y los proveedores están descritos en [`docs/development.md`](../development.md) y [`docs/deploy.md`](../deploy.md#variables-de-entorno-de-la-api).

### Regenerar este manual

Este manual y sus capturas se generan con datos de demostración inventados. Las contraseñas **nunca** van en el manual, en los scripts ni en los logs: se pasan por variables de entorno.

Los scripts **no necesitan archivos `.env`**: toman todo del entorno del proceso. `manual:demo-data` usa `DB_NAME` y `DB_USER` del entorno (para la historia por SQL) y solo si faltan los lee de `apps/api/.env`, si ese archivo existe; si no hay ni entorno ni archivo, falla con un mensaje claro.

```bash
# 1. Base de demostración vacía (migrada y con seed) y un staff creado con user:create-staff (paso 3 de arriba),
#    usando como CREATE_STAFF_PASSWORD la misma contraseña que se va a pasar en MANUAL_STAFF_PASSWORD
# 2. API y web corriendo, con la web compilada para producción (pnpm --filter @move/web build, con NODE_ENV=production
#    si el shell tiene otro valor, y pnpm --filter @move/web start). Definir DB_NAME (y DB_USER si no es "move"),
#    API_URL (con /api) y WEB_URL (origen de la web); por defecto apuntan a http://localhost:3001/api y http://localhost:3000
export DB_NAME=move_demo API_URL=http://localhost:3001/api WEB_URL=http://localhost:3000   # ejemplo
read -rs MANUAL_STAFF_PASSWORD && export MANUAL_STAFF_PASSWORD
read -rs MANUAL_CLIENT_PASSWORD && export MANUAL_CLIENT_PASSWORD     # mínimo 8 caracteres
pnpm exec playwright install chromium     # una sola vez
pnpm manual:demo-data       # carga 10 clientes de ejemplo en distintos estados, reservas, pagos, alertas y check-ins
pnpm manual:screenshots     # una captura por pantalla en docs/manual/img/ (1440×900)
# editar docs/manual/manual-de-usuario.md si cambió algo
pnpm manual:pdf             # genera docs/manual/manual-de-usuario.pdf (A4, imágenes embebidas)
```

- `manual:demo-data` falla con un mensaje claro si la base ya tiene datos de demostración. La historia (asistencias pasadas y planes que vencen o vencieron) no se puede crear por la API porque no admite reservar ni marcar asistencia en el pasado: esos datos se insertan con SQL en la base de desarrollo mediante `docker exec <contenedor> psql` (contenedor `move-postgres`, o `MANUAL_DB_CONTAINER`), solo para los clientes de demostración.
- `manual:screenshots` compra un paquete de Recovery con el cliente de demostración Nicolás Acosta (checkout → simulador → resultado); volver a correrlo agrega otra compra, así que para repetir las capturas conviene recrear la base de demostración. La captura de Recovery (`07`) se toma sin sesión iniciada, como un invitado.
- Usuarios de la demostración: staff `staff@example.com` (o `MANUAL_STAFF_EMAIL`) con la contraseña de `MANUAL_STAFF_PASSWORD`; clientes `sofia.martinez@example.com`, `martin.rodriguez@example.com`, `lucia.pereira@example.com`, `andres.silva@example.com`, `camila.fernandez@example.com`, `joaquin.techera@example.com`, `valentina.gomez@example.com`, `federico.alvarez@example.com`, `diego.machado@example.com` y `nicolas.acosta@example.com`, todos con la contraseña de `MANUAL_CLIENT_PASSWORD`.

### Pasos faltantes para el deploy

Fuente completa: [`docs/deploy.md`](../deploy.md). Nada de esto se ejecutó todavía; requiere los accesos a Neon, AWS, Vercel y los proveedores. En orden:

1. **Base de datos en Neon.** Crear una base nueva (Postgres 17, sin reutilizar el esquema anterior). Usar el host **directo** (sin `-pooler`: los jobs usan locks de sesión). Definir `DB_*` con `DB_SSL=true`. Correr las migraciones **antes** de cambiar el tráfico, desde el mismo bundle que se despliega (`node_modules/.bin/typeorm migration:run -d dist/database/data-source.js`) y cargar el seed (`node dist/database/seed.js`).
2. **API en AWS Elastic Beanstalk (Node 24).** Generar el zip con `bash scripts/package-api-eb.sh`, crear el entorno *Web server* con la plataforma Node.js 24, cargar las variables de entorno de la API, subir el zip y configurar el health check en `GET /api/health`. HTTPS con certificado en ACM y dominio `api.move.uy`.
3. **Proxy y límite de body de auth.** `/api/auth/*` responde 413 a cualquier request de más de 64 KB o con `Transfer-Encoding` sin `content-length`. El proxy (Nginx de Beanstalk o el ALB) tiene que **reenviar `content-length`**: dejar `proxy_request_buffering on` (el default).
4. **IP del cliente detrás del proxy (`TRUST_PROXY_HOPS`).** El checkout limita los intentos por IP (10 por minuto y, en reservas, 20 por hora). Detrás del ALB y el Nginx de Beanstalk la API recibe todas las requests desde el proxy, así que hay que definir `TRUST_PROXY_HOPS=2` (un solo dígito de 0 a 5; el default `0` ignora `X-Forwarded-For`). **Nunca `true`**: confiaría en todo el header, que el cliente puede escribir, y cualquiera podría saltarse el límite cambiando su IP. Un valor mayor que la cantidad real de proxies tiene el mismo problema; uno menor (o dejar `0`) hace que todos los clientes compartan un solo contador y el checkout se bloquee para todos. Si cambia la topología (por ejemplo, se agrega CloudFront), ajustar el valor y repetir la verificación "IP real detrás del proxy" del checklist. Además, los contadores viven en la memoria de cada instancia: con N instancias el límite efectivo es hasta N veces el configurado. Detalle en [`docs/deploy.md`](../deploy.md#proxy-ip-del-cliente-y-límites-de-checkout).
5. **Scheduler en una sola instancia.** Dejar el entorno con una instancia, o `SCHEDULER_ENABLED=true` en una y `false` en las demás (solo se aceptan esos dos valores).
6. **Web en Vercel.** Importar el repo con *Root Directory* `apps/web`, Node 24, definir `NEXT_PUBLIC_API_URL` (con `/api`) y, si corresponde, `NEXT_PUBLIC_GOOGLE_ENABLED`. Producción desde `main`; los previews apuntan a la API de **desarrollo**, nunca a la de producción.
7. **Dominio raíz y cookies.** Web y API bajo el mismo dominio raíz para que la cookie de sesión sea first-party: `COOKIE_DOMAIN=.move.uy` (con el punto inicial), `WEB_URL=https://move.uy`, `API_PUBLIC_URL=https://api.move.uy`, `NEXT_PUBLIC_API_URL=https://api.move.uy/api`. `api.move.uy` es un CNAME al entorno de Beanstalk y `move.uy` usa los registros que indique Vercel. En producción las cookies son `Secure`: probar siempre por HTTPS.
8. **Primer staff de producción.** Con las variables `DB_*` de producción y `CREATE_STAFF_PASSWORD` por variable: `node dist/cli/create-staff.js --email <email> --name "<Nombre Apellido>"` desde el bundle descomprimido (con `SCHEDULER_ENABLED=false`). Si el email ya tiene una cuenta, agregar `--promote-existing` (ver el paso 3 de "Correr todo en local").
9. **Checklist posterior al deploy** (ver el detalle en `docs/deploy.md`): health, IP real detrás del proxy (`TRUST_PROXY_HOPS=2`), carga de la web sin errores de CORS, registro y login con cookie `Secure` y dominio `.move.uy`, `/api/staff/dashboard` con 401 sin sesión y 403 con sesión de cliente, pago de prueba de punta a punta, webhook recibido, email recibido, crons en los logs, y **reemplazar los valores provisorios** de Configuración.

En producción (`NODE_ENV=production`) la API exige las credenciales de proveedores y deshabilita el simulador de pagos.

### Pasos faltantes por integración

#### Mercado Pago

1. Probar de punta a punta primero con las **credenciales de prueba** (usuarios y tarjetas de prueba) en un entorno de staging; recién después pasar a las de producción.
2. Cargar `MP_ACCESS_TOKEN` (access token de la aplicación).
3. En *Tus integraciones → Webhooks* configurar la **URL pública** `https://<api>/api/payments/webhook/mercadopago` con el evento de pagos y copiar la clave secreta a `MP_WEBHOOK_SECRET`.
4. La API verifica la firma de cada notificación (firma inválida: 401 sin efectos) y es idempotente: repetir una notificación, o recibirla además por la conciliación periódica, no duplica la suscripción ni extiende la vigencia dos veces.
5. A tener en cuenta: los pagos de plan rechazados quedan `pending` (el cliente puede reintentar); si un pago se aprueba cuando la reserva ya venció y el turno no tiene cupo, la compra queda aprobada y marcada para atención del staff.

#### Brevo

1. Verificar el dominio o el remitente en Brevo y crear una API key.
2. Cargar `BREVO_API_KEY`, `BREVO_SENDER_EMAIL` (el **remitente verificado**) y, si se quiere, `BREVO_SENDER_NAME` (default `MOVE`).
3. Sin `BREVO_API_KEY` la API no envía nada (dry-run). En producción la variable es obligatoria.

#### Google OAuth (opcional)

1. En Google Cloud Console crear un cliente OAuth tipo *Web application*.
2. Orígenes autorizados: `https://move.uy`. URI de redirección autorizada: `https://<api>/api/auth/callback/google` (por ejemplo `https://api.move.uy/api/auth/callback/google`).
3. Cargar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` (las dos o ninguna) en la API y `NEXT_PUBLIC_GOOGLE_ENABLED=true` en Vercel. Una cuenta por email: Google se vincula a la cuenta que ya exista con ese email.

#### Dominio y cookies

Ver el paso 7 del deploy. Si la web y la API quedaran en dominios distintos, la cookie de sesión dejaría de ser first-party y el login no funcionaría como está diseñado.

### Valores provisorios y decisiones abiertas

Los planes, precios, horarios y umbrales son los del mockup y deben ser confirmados por MOVE. Hasta entonces la pantalla de Reglas muestra "Valores provisorios — confirmar con MOVE".
