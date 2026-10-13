---
type: system
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/subscriptions/subscriptions.module.ts
  - move/apps/api/src/modules/subscriptions/services/subscriptions.service.ts
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
---
# Modulo suscripciones

Planes contratados: vigencia por fechas de negocio, renovaciones programadas y saldo
de sesiones de paquetes Recovery. Responde si un cliente tiene plan o paquete vigente
para un servicio en la fecha de un turno.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo usuarios]]
