---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# MOC Pagos y activacion

Espina 2. De "Contratar" a un plan activo o una reserva confirmada, sin activar nada
de más ni de menos.

## Cadena
- [[Compra]] → [[Pago]] → [[Webhook de Mercado Pago]] → [[Modulo pagos]] → [[Modulo suscripciones]] o [[Modulo reservas]]
- El navegador vuelve a [[Pantalla checkout de pago]], que solo consulta el estado.
- Sin credenciales, el [[Simulador de pagos de desarrollo]] reemplaza a [[Mercado Pago]].

## Decisiones
- [[ADR Mercado Pago como procesador de pagos]]
- [[ADR pago tardio sin lugar queda para el staff]] y [[ADR retencion vencida sin lugar no se reconfirma]]
- [[ADR pago de plan rechazado deja la compra pendiente]] y [[ADR reintento visible para plan rechazado]]
- [[ADR conciliacion re-consulta compras vencidas]] (reemplaza a [[ADR conciliacion de compras de plan vencidas]])
- [[ADR limite de retenciones y de checkout por IP]] y [[ADR IP real detras del proxy y ventana horaria]]
- [[ADR simulador registrado con ConditionalModule]]
- Abierta: [[ADR notificaciones de Mercado Pago por ambiente]]

- [[ADR conciliacion de reservas vencidas por 72 horas]] (reemplaza a la anterior: reservas 72 horas, planes 7 días, sin re-consultar rechazadas)
- Síntoma "la página de pago consulta para siempre": [[Polling de pago sin tope ante errores]] (resuelto)

## Reglas
- [[Pago confirmado solo por webhook validado]]
- [[Operaciones de pago idempotentes]] y [[Queries crudas con RETURNING via CTE]]
- [[Activacion en la misma transaccion que el pago]]
- [[Conciliacion periodica de pagos pendientes]]
- [[Logica de negocio fuera de Mercado Pago]] y [[Integraciones externas encapsuladas en un servicio]]
- [[Reserva confirmada solo con pago aprobado]]
- [[Retenciones de pago limitadas por usuario]] y [[Checkout publico limitado por IP]]
- [[Simulador de pagos solo fuera de produccion]]

## Diagnóstico
Síntoma "pagó y no tiene plan": [[Pago aprobado sin activar plan]] ← [[Webhook legitimo rechazado]],
el webhook que nunca llegó o [[Pago tardio perdido tras expirar la compra]]. Síntoma "plan
gratis": [[Plan activado sin pago confirmado]] ← [[Webhook falsificado]] o
[[Simulador de pagos montado en produccion]]. Síntoma "plan doble": [[Vigencia extendida dos veces]] ←
[[Webhook duplicado procesado dos veces]] o [[Guard muerto por UPDATE RETURNING sin CTE]].
Síntoma "nadie puede pagar": [[Throttling por IP ve la IP del proxy]].
