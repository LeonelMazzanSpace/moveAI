---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# Queries crudas con RETURNING via CTE

Todo `UPDATE` o `DELETE … RETURNING` que pasa por `manager.query` o
`dataSource.query` se escribe como `WITH x AS (UPDATE … RETURNING …) SELECT … FROM x`,
para recibir solo las filas. El orquestador revisó toda la API después de T-032 y no
quedan casos sin CTE.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Guard muerto por UPDATE RETURNING sin CTE]]
