---
type: moc
status: shipped
updated: 2026-10-14
source:
  - move/MOVE.pdf#p16
  - move/MOVE.pdf#p19
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
---
# MOC Roadmap MVP

Plan de 4 semanas de la propuesta (12/10/2026–06/11/2026), con dos Full Stack. Al
2026-10-13 el contenido de las cuatro semanas está construido y verificado en local
(tareas T-000 a T-037 de `feature/move-mvp`); el 2026-10-14 se sumó la tanda de
comentarios del cliente (T-057 a T-071). Falta todo lo que necesita accesos:
deploy, credenciales de proveedores y definiciones de MOVE. Para cada nota de trabajo,
construir antes lo que ella `depends on` y cubrir con tests las fallas que previenen
sus restricciones entrantes (ver `_meta/edges.md`).

## Semana 1 — Base y experiencia pública
1. [[Monorepo MOVE]], [[App web Next]], [[API NestJS]], [[Postgres local Docker]]
2. Desbloqueado: [[ADR ubicacion de Better Auth]] (en Nest); [[Accesos y definiciones operativas al inicio]] sigue pendiente, sin bloquear
3. [[Modulo usuarios]], [[Modulo auth]] con [[Better Auth]]; [[Google OAuth]] apagado hasta tener credenciales
4. [[Modulo configuracion]], [[Modulo catalogo]], [[Modulo agenda]], [[Modulo reservas]]
5. [[Area publica web]]: [[Pantalla sitio publico]], [[Pantalla acceso]], Performance, Rehab y Recovery
6. [[Panel staff web]] con guard de rol y [[Pantalla dashboard staff]]
7. Ambientes: [[Vercel]], [[AWS Elastic Beanstalk]], [[Neon Postgres]] siguen sin configurar ([[ADR sin deploy en el run del MVP]])

## Semana 2 — Performance: planes, pagos y reservas
1. [[Modulo suscripciones]] y [[Pantalla configuracion staff]]
2. [[Modulo pagos]] contra el [[Simulador de pagos de desarrollo]] ([[Mercado Pago]] apagado sin credenciales), [[Pantalla checkout de pago]] y [[NestJS Scheduler]]
3. Reservar y cancelar en [[Modulo reservas]]
4. [[Pantalla Performance]] y [[Pantalla perfil cliente]]
5. Asistencia, ver [[Reserva distinta de asistencia]]

## Semana 3 — Rehab, Recovery y gestión operativa
1. [[Modulo notificaciones]] con [[Brevo]] en dry-run, [[Pantalla Rehab]] y [[Pantalla Recovery]]
2. [[Modulo clientes]], [[Pantalla clientes staff]], [[Pantalla turnos y asistencia]], [[Pantalla pagos staff]]
3. [[Modulo seguimiento]] con [[Motivo de inactividad]]

## Semana 4 — Seguimiento, automatizaciones y producción
1. [[Pantalla seguimiento]] y [[Pantalla check-in]]
2. [[Modulo automatizaciones]] sobre [[NestJS Scheduler]]
3. Review transversal y fixes: [[ADR limite de retenciones y de checkout por IP]], [[ADR IP real detras del proxy y ventana horaria]], [[ADR simulador registrado con ConditionalModule]], [[ADR conciliacion re-consulta compras vencidas]]
4. [[Manual de usuario]] y [[Pipeline CI Bitbucket]]
5. Pendiente: despliegue productivo, ver [[MOC Plataforma y entrega]]

## Tanda de comentarios del cliente (2026-10-14, T-057…T-071)
Rama `feature/move-feedback` (spec `docs/superpowers/specs/2026-10-14-move-feedback-design.md`), todavía sin merge a `main`.

1. Landing: [[ADR Equipo y Recovery Room como contenido fijo]] y [[ADR regla Plan vigente en Performance]]
2. Contacto: [[ADR contacto editable en configuracion]] en [[Modulo configuracion]]
3. Mails: [[ADR mails nuevos y pie de contacto]] en [[Modulo notificaciones]], [[Modulo reservas]] y [[Modulo automatizaciones]]
4. Rehab ↔ Google: [[ADR Google Calendar bidireccional con un calendario de MOVE]] → [[Google Calendar]] (apagado sin credenciales)
5. Mercado Pago: [[ADR debito automatico con preapproval]] → [[Debito automatico]], probado con el simulador
6. Responsive y E2E: [[ADR auditoria responsive y cambios visuales]], [[ADR suite E2E desktop y mobile]]
7. Pendiente: prueba real con credenciales de MP (suscripciones), Google Calendar y Brevo; manual (T-068)

## Lo que falta para producción
- Accesos y dominio: [[Accesos y definiciones operativas al inicio]], [[Web y API bajo el mismo dominio raiz]], [[Ambiente dev en dominio registrable propio]]
- Deploy: [[PORT explicito en Elastic Beanstalk]], [[IP real del cliente detras del proxy]], [[Rama dev de Neon sin expiracion]], [[Conexion SSL a la base en produccion]]
- Credenciales nuevas de la tanda: Mercado Pago con Suscripciones habilitado, proyecto de Google con Calendar API y `CALENDAR_TOKEN_KEY` (checklist "Prueba real" de la spec)
- Decisiones abiertas: [[ADR notificaciones de Mercado Pago por ambiente]], [[Bloqueo de IPs de Brevo resuelto antes de produccion]], [[ADR push a GitHub y merge por PR]], [[Prioridad de horarios Recovery]]
