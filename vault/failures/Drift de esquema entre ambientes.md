---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/database/typeorm.options.ts
  - move/apps/api/test/schema.e2e-spec.ts
---
# Drift de esquema entre ambientes

El esquema de la base de un ambiente difiere de las entidades o de otro ambiente.
Defensa activa: `synchronize` apagado y esquema solo por migraciones; un e2e verifica
sobre la base migrada las restricciones y la configuración por defecto.
