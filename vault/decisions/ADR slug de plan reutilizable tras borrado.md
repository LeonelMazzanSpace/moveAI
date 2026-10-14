---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/catalog/entities/plan.entity.ts
  - move/apps/api/src/database/migrations/1791927872744-PlansSlugUniqueWhenNotDeleted.ts
  - move/apps/api/src/database/seed-data.ts
---
# ADR slug de plan reutilizable tras borrado

T-039 y D74: el slug de un plan es único solo entre planes no borrados (índice parcial
`UQ_plans_slug_not_deleted`), así un plan eliminado libera su slug; `SLUG_TAKEN` sigue
entre planes vivos. El seed no recrea un plan cuyo slug exista en cualquier fila, para
no resucitar planes que el staff borró. Revertir la migración exige renombrar antes los
duplicados borrados (runbook en `docs/deploy.md`).

## Structural
- constrains → [[Modulo catalogo]]
- enables → [[Seed rompe con indice unico parcial]]
