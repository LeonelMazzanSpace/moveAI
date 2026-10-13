---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/database/typeorm.options.ts
  - move/apps/api/package.json
---
# Esquema solo via migraciones

`synchronize: false`: todo cambio de esquema es una migración de TypeORM generada
por CLI, revisada y versionada. Verificado en `typeorm.options.ts` el
2026-10-13.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Drift de esquema entre ambientes]]
