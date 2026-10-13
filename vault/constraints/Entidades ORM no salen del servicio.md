---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/database/typeorm.options.ts
---
# Entidades ORM no salen del servicio

Estándar SpaceDev. Las entidades TypeORM (`*.entity.ts`) solo las usa el service de
su módulo. Hacia afuera circula el modelo (`*.model.ts`) y la API responde con DTOs de
respuesta mapeados (`plainToInstance` + `@Expose`), nunca con entidades.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Entidad ORM expuesta en la API]]
