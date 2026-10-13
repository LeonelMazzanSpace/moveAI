---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p16
  - move/MOVE.pdf#p17
  - move/MOVE.pdf#p18
  - move/MOVE.pdf#p19
---
# MOC Roadmap MVP

Plan de 4 semanas de la propuesta (12/10/2026–06/11/2026), con dos Full Stack: FS1
enfocado en la web y los flujos (Next, pantallas, calendario, panel) y FS2 en lógica de
negocio, datos, integraciones e infraestructura. Es un foco, no una división rígida. Al 2026-10-13 está en
curso la semana 1. Para cada nota de trabajo, construir antes lo que ella `depends on`
y cubrir con tests las fallas que previenen sus restricciones entrantes (ver
`_meta/edges.md`). Orden sugerido dentro de cada semana.

## Semana 1 — Base y experiencia pública (12–16/10)
1. [[Monorepo MOVE]], [[App web Next]], [[API NestJS]], [[Postgres local Docker]] (hechos)
2. Desbloquear: [[ADR ubicacion de Better Auth]], [[Accesos y definiciones operativas al inicio]]
3. [[Modulo usuarios]], luego [[Modulo auth]] con [[Better Auth]] y [[Google OAuth]]
4. Modelo inicial: [[Modulo catalogo]] (servicios, planes), entidades base de [[Modulo agenda]] y [[Modulo reservas]]
5. [[Area publica web]]: [[Pantalla sitio publico]], [[Pantalla acceso]], páginas informativas de Performance, Rehab y Recovery
6. Base de [[Panel staff web]] con guard de rol; [[Pantalla dashboard staff]] es draft (sin mockup)
7. Ambientes: [[Vercel]], [[AWS Elastic Beanstalk]], [[Neon Postgres]], ver [[Ambientes dev y produccion separados]]

Demo: navegación general, Performance, Rehab y Recovery, registro y login, Google,
acceso diferenciado de Cliente y Staff.

## Semana 2 — Performance: planes, pagos y reservas (19–23/10)
1. [[Modulo suscripciones]] y [[Pantalla configuracion staff]] (draft: no hay mockup; definir con diseño)
2. [[Modulo pagos]] con [[Mercado Pago]] y [[Pantalla checkout de pago]] (proposed); si se confirma la conciliación, arranca [[NestJS Scheduler]]
3. [[Modulo agenda]] (horarios y cupos) y [[Modulo reservas]] (reservar y cancelar)
4. [[Pantalla Performance]] completa y [[Pantalla perfil cliente]] (plan, vencimiento, próximas reservas)
5. Base de asistencia, ver [[Reserva distinta de asistencia]]

Demo: plan → contratación → pago → activación → horarios → reserva, más el bloqueo sin
plan vigente.

## Semana 3 — Rehab, Recovery y gestión operativa (26–30/10)
1. [[Modulo notificaciones]] con [[Brevo]] (emails de confirmación), luego [[Pantalla Rehab]]: disponibilidad, pago y confirmación
2. [[Pantalla Recovery]]: sesiones y paquetes
3. [[Pantalla clientes staff]], [[Pantalla turnos y asistencia]], [[Pantalla pagos staff]] (draft)
4. Historial de asistencias y cancelaciones; arranca [[Modulo seguimiento]] con [[Motivo de inactividad]]

Demo: reserva Rehab, reserva Recovery, panel staff con clientes, reservas y asistencia
(presente, ausente, no show).

## Semana 4 — Seguimiento, automatizaciones y producción (02–06/11)
1. [[Modulo seguimiento]] completo (alertas, contactos, check-ins) y [[Pantalla seguimiento]]
2. [[Modulo automatizaciones]] con [[NestJS Scheduler]]
3. Emails de seguimiento, avisos y check-ins sobre [[Modulo notificaciones]]
4. [[Pantalla check-in]]
5. Pruebas integrales de auth, pagos y reservas; permisos; responsive; despliegue productivo; documentación

Demo: punta a punta cliente → plan → pago → reserva → asistencia → seguimiento, con al
menos una automatización activa y un email enviado por Brevo.
