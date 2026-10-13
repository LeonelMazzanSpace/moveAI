---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/test/webhook.e2e-spec.ts
---
# Guard muerto por UPDATE RETURNING sin CTE

Con el driver Postgres de TypeORM, `manager.query` devuelve `[filas, rowCount]` para un
`UPDATE` o `DELETE … RETURNING`, no las filas. El guard que impedía aplicar dos veces
una compra contaba ese par, siempre de largo 2, y nunca frenaba un segundo pago
(T-032, hallazgo I-4 del review T-027). Fix: la transición usa
`WITH moved AS (UPDATE … RETURNING id) SELECT id FROM moved`, con un test que falla con
el guard muerto.

## Structural
- causes → [[Vigencia extendida dos veces]]
