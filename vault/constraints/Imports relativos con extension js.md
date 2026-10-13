---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/tsconfig.json
  - move/apps/api/package.json
---
# Imports relativos con extension js

La API es ESM con `nodenext`, así que los imports relativos llevan la extensión
`.js` aunque el archivo sea `.ts`. El CLI de migraciones corre sobre `dist/`.

## Structural
- constrains → [[API NestJS]]
