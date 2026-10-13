---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p6
  - move/MOVE.pdf#p7
  - move/MOVE.pdf#p12
---
# MOC Seguimiento y retencion

Espina 3. De los datos de asistencia a una acción del staff que retiene o reactiva al
cliente.

## Cadena
- [[Asistencia]] → [[Metricas de actividad]] → [[Estado del cliente]] (+ [[Suscripcion]], [[Motivo de inactividad]])
- [[Regla de automatizacion]] ([[Umbrales de seguimiento]]) + [[Estado del cliente]] → [[Alerta de seguimiento]]
- [[Check-in]] ([[Envio de check-ins]]) → [[Alerta de seguimiento]] → [[Contacto de seguimiento]] → [[Historial del cliente]]
- Ejecución: [[Modulo automatizaciones]] sobre [[NestJS Scheduler]], emails por [[Modulo notificaciones]]; vistas en [[Modulo clientes]]

## Reglas
- [[Reglas de automatizacion en Postgres]]
- [[Jobs programados idempotentes]] y [[Scheduler corre en una sola instancia]]
- [[Clientes en pausa excluidos de alertas]]
- [[Check-in con molestia genera alerta]]
- [[ADR renovacion programada no cuenta como por vencer]]

## Fallas
[[Cliente vencido sin seguimiento]] · [[Alertas de inactividad falsas]] · [[Alertas o emails duplicados]] ·
[[Job ejecutado en varias instancias]] · [[Molestia reportada sin intervencion]] · [[Metricas de retencion incorrectas]] ·
[[Email automatico indebido al cliente]] · [[Emails bloqueados por IP nueva en Brevo]]
