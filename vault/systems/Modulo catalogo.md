---
type: system
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/catalog/catalog.module.ts
  - move/apps/api/src/modules/catalog/services/catalog.service.ts
  - move/apps/api/src/modules/catalog/domain/plan-rules.ts
---
# Modulo catalogo

Planes y paquetes vendibles de los tres servicios: precio, período, sesiones
incluidas y si están activos. El staff los administra y el sitio público los lee; los
de la semilla son provisorios.

## Structural
- is part of → [[API NestJS]]
