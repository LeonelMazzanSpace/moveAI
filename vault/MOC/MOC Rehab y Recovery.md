---
type: moc
status: shipped
updated: 2026-10-14
source:
  - move/MOVE.pdf#p5
  - move/MOVE.pdf#p11
---
# MOC Rehab y Recovery

Servicios que también vende la web a no alumnos: reserva paga con horario bloqueado.

## Rehab
- [[Servicio Rehab]] → [[Evaluacion y diagnostico]] sobre [[Disponibilidad profesional]]; después, [[Seguimiento fisioterapeutico]] habilitado por el staff
- Flujo: evaluación → fecha y horario → pago → reserva confirmada → email ([[Pantalla Rehab]])
- Reglas: [[Horario Rehab se bloquea al reservar]], [[Reserva pendiente de pago expira]], [[Reserva confirmada solo con pago aprobado]], [[Rehab no vende tratamientos online]]
- Decisión: [[ADR profesionales inactivos fuera de la agenda]]

## Google Calendar (Rehab)
- [[ADR Google Calendar bidireccional con un calendario de MOVE]] → [[Google Calendar]] (apagado sin credenciales)
- Reglas: [[Turno bloqueado por Google no reservable]], [[Conexion de calendario re-verificada antes de escribir]], [[Calendario perdido se olvida al reconectar]]
- Fallas resueltas: [[Turnos bloqueados sin conexion de calendario]] · [[Reconexion vuelve al calendario perdido]]

## Recovery
- [[Servicio Recovery]]: sesión individual o [[Paquete de sesiones Recovery]] ([[Pantalla Recovery]], [[Sesiones Recovery no usadas]]); [[Prioridad de horarios Recovery]] sigue sin definir
- Flujo: selección → reserva → pago → confirmación
- Reglas: [[Sesiones Recovery no exceden el paquete]], [[Reserva confirmada solo con pago aprobado]]
- Contenido de la sala: [[ADR Equipo y Recovery Room como contenido fijo]]; los packs admiten [[Debito automatico]]

## Compartido
- [[Retenciones de pago limitadas por usuario]] y [[Checkout publico limitado por IP]]
- [[ADR retencion vencida sin lugar no se reconfirma]]
- Mails de reserva y recordatorio del día anterior: [[ADR mails nuevos y pie de contacto]]

## Fallas
[[Doble reserva del mismo horario Rehab]] · [[Horario retenido por pago abandonado]] ·
[[Retenciones masivas de invitados]] · [[Reserva confirmada sin pago]] ·
[[Tratamiento vendido sin evaluacion]] · [[Paquete Recovery sobreconsumido]]
