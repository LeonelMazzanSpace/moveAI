# MOVE MVP — Resumen del plan

Vamos a construir la nueva plataforma de MOVE completa: un sitio público con Performance, Rehab y Recovery, el área de cada cliente y el panel del staff. Todo el circuito queda en un solo lugar: registro → plan → pago → reserva → asistencia → seguimiento → renovación.

Plan completo: [2026-10-13-move-mvp.md](./2026-10-13-move-mvp.md)

## Qué va a poder hacer cada persona

**Visitantes**
- Ver Performance, Rehab, Recovery y los planes con precios.
- Reservar y pagar una Evaluación de Rehab o una sesión de Recovery sin tener cuenta; la cuenta se crea en el camino.

**Clientes**
- Registrarse e ingresar con email o con Google, y recuperar la contraseña.
- Contratar y renovar planes Performance y paquetes Recovery con Mercado Pago. Si renuevan antes de vencer, no pierden días.
- Reservar turnos de Performance mientras tengan el plan vigente, con cupos en tiempo real. Con el plan vencido, la plataforma pide renovar.
- Reservar Recovery usando su paquete y, si el staff lo habilita, turnos de seguimiento fisioterapéutico.
- Cancelar dentro del plazo permitido.
- Ver en su perfil el plan, el vencimiento, las próximas reservas, el historial, los avisos y su actividad del mes.
- Responder check-ins mensuales.

**Staff de MOVE**
- Ver un dashboard con clientes activos, planes por vencer, alertas y los turnos del día.
- Consultar la lista de clientes con estado, plan, pagos, última asistencia, frecuencia y uso de Rehab y Recovery. Dar de alta clientes.
- Ver cada turno y marcar Presente, Ausente o No show.
- Ver los pagos y registrar pagos en efectivo o por transferencia.
- Usar una bandeja de seguimiento con alertas automáticas: por vencer, vencidos, una semana sin asistir, inactividad prolongada, baja de frecuencia, re-contactar y molestias reportadas en check-ins. Desde ahí se contacta al cliente, se registra el motivo de inactividad o se lo deriva a Rehab.
- Configurar planes, precios, horarios, cupos, profesionales y las reglas: plazo de cancelación, umbrales de las alertas y check-in mensual.

**Automático**
- Recordatorios de vencimiento.
- Detección diaria de alertas.
- Check-in el primer lunes de cada mes.
- Liberación de turnos no pagados.
- Conciliación de pagos.
- Emails por Brevo.

## Para tener en cuenta
- Todavía no hay accesos a Neon, Mercado Pago, Brevo, Google, Vercel ni AWS. Mientras tanto se trabaja en local con un simulador de pagos y los emails quedan registrados sin enviarse. El salir a producción queda documentado para cuando lleguen los accesos.
- Los precios, horarios y umbrales del mockup se cargan como **provisorios** y el staff los puede editar.
- El usuario confirmó el plan y sus 7 decisiones pendientes el 2026-10-13:
  - modo de permisos de los workers;
  - cómo corre el worker de ClickUp;
  - cancelación de reservas pagas;
  - invitado con email ya registrado;
  - verificación de email;
  - pagos aprobados sin cupo;
  - mapeo de estados en ClickUp.
