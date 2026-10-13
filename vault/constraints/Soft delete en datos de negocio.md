---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/users/entities/user.entity.ts
  - move/apps/api/src/modules/bookings/entities/booking.entity.ts
  - move/apps/api/src/modules/payments/entities/purchase.entity.ts
---
# Soft delete en datos de negocio

Estándar SpaceDev. Usuarios, planes, profesionales, plantillas, suscripciones,
compras y reservas usan `deleted_at` en lugar de borrado físico, y los KPIs excluyen
lo borrado. El historial que centraliza la base es el activo del negocio.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Historial perdido por borrado fisico]]
