---
type: system
status: todo
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Modulo pagos

Módulo que crea operaciones en Mercado Pago, las asocia a usuario y plan o
reserva, recibe y valida las notificaciones, registra el estado del pago y dispara
la activación del plan o la confirmación de la reserva.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Mercado Pago]]
- depends on → [[Modulo suscripciones]] because activa o renueva planes
- depends on → [[Modulo reservas]] because confirma reservas pagas de Rehab y Recovery
