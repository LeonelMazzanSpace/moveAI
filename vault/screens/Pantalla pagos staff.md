---
type: screen
status: shipped
semana: 3
updated: 2026-10-14
source:
  - move/apps/web/src/app/staff/pagos/page.tsx
  - move/apps/web/src/components/staff/pagos/manual-payment-dialog.tsx
  - move/apps/web/src/components/staff/pagos/payments-table.tsx
---
# Pantalla pagos staff

Pagos del panel, sin mockup. Resuelto (D7): lista las operaciones, marca las compras
que necesitan atención y permite registrar pagos manuales (efectivo o transferencia)
que activan el plan en la misma transacción. Los cobros de débito automático llevan
el badge "Débito automático" y hay filtro por origen.

## Structural
- is part of → [[Panel staff web]]
- depends on → [[Modulo pagos]]
