---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/database/data-source.ts
  - move/apps/api/src/database/typeorm.options.ts
  - move/apps/api/package.json
---
# ADR TypeORM con migraciones por CLI

TypeORM con `synchronize` apagado. Las migraciones se generan y corren con el CLI
sobre el build (`dist/database/data-source.js`) para evitar problemas de ts-node con
metadata de decoradores.

## Structural
- establishes → [[Esquema solo via migraciones]]
- establishes → [[Nombres snake_case en DB]]
- establishes → [[Soft delete en datos de negocio]]
