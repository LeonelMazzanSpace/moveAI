---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/MOVE.pdf#p11
---
# MOC Circuito Performance

Espina 1. Cómo un cliente pasa de ver un plan a tener una asistencia registrada, y
qué protege cada tramo.

## Cadena
- [[Servicio Performance]] → [[Plan]] → [[Compra]] → [[Pago]] → [[Suscripcion]]
- [[Horario]] → [[Reserva]] → [[Cancelacion]] o [[Asistencia]]; para Performance, [[Reserva Performance requiere plan vigente]] exige una [[Suscripcion]] vigente
- [[Asistencia]] → [[Metricas de actividad]], que alimenta [[MOC Seguimiento y retencion]]

## Reglas
- [[Reserva Performance requiere plan vigente]]
- [[Cupo maximo por horario]] y [[Reserva con bloqueo transaccional]]
- [[Cancelacion con limite configurable]] y [[Cancelacion libera el cupo]]; online solo se cancelan reservas de plan, paquete o seguimiento, ver [[Cancelacion]]
- [[Reserva distinta de asistencia]] y [[Asistencia pendiente visible para staff]]
- [[Renovacion extiende desde el vencimiento]]
- [[Fechas en zona horaria de Uruguay]], según [[ADR zona horaria de negocio]]

## Fallas a las que apunta
[[Sobreventa de cupos]] · [[Reserva con plan vencido]] · [[Cancelacion fuera de plazo aceptada]] ·
[[Cupo bloqueado por cancelacion]] · [[Asistencia no registrada]] · [[Dias de plan perdidos al renovar]]
