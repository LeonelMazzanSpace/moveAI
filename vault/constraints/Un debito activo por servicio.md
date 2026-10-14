---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/database/migrations/1791994688446-AutoDebits.ts
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/test/auto-debits.e2e-spec.ts
---
# Un debito activo por servicio

Un cliente tiene como máximo un débito `pending` o `authorized` por servicio: lo
garantizan un índice único parcial sobre `(user_id, service)` y un advisory lock en el
checkout, así dos checkouts simultáneos no dejan dos activos. Iniciar uno nuevo cancela
el `pending` anterior del mismo servicio; con uno `authorized` responde
`AUTO_DEBIT_ACTIVE` (D97).

## Structural
- constrains → [[Debito automatico]]
- mitigates → [[Vigencia extendida dos veces]]
