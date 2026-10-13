---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/database/entities.ts
  - move/apps/api/src/modules/bookings/models/booking.model.ts
---
# Entidades ORM no salen del servicio

Estándar SpaceDev. Las entidades TypeORM solo las usa el service de su módulo. Entre
módulos circulan modelos planos (`models/`) y los controllers responden objetos con la
forma exacta del contrato, nunca entidades.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Entidad ORM expuesta en la API]]
