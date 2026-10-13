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

## Reglas
- [[Pago confirmado solo por webhook validado]]
- [[Operaciones de pago idempotentes]]
- [[Activacion en la misma transaccion que el pago]]
- [[Conciliacion periodica de pagos pendientes]]
- [[Logica de negocio fuera de Mercado Pago]] y [[Integraciones externas encapsuladas en un servicio]]
- [[Reserva confirmada solo con pago aprobado]]

## Diagnóstico
Síntoma "pagó y no tiene plan": [[Pago aprobado sin activar plan]] ← [[Webhook legitimo rechazado]] o el webhook que nunca llegó. Síntoma "plan
gratis": [[Plan activado sin pago confirmado]] ← [[Webhook falsificado]]. Síntoma
"plan doble": [[Vigencia extendida dos veces]] ← [[Webhook duplicado procesado dos veces]].
