---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/database/snake-naming.strategy.ts
  - move/apps/api/src/database/typeorm.options.ts
---
# Nombres snake_case en DB

Tablas, columnas, columnas FK, tablas y columnas de join se nombran en snake_case con
un `SnakeNamingStrategy` propio, porque TypeORM 1.x no trae uno. Los nombres de
restricciones e índices (PK, FK, IDX) siguen el default hasheado de TypeORM. Las
entidades siguen en camelCase.

## Structural
- constrains → [[API NestJS]]
