---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
  - move/apps/api/src/modules/payments/services/payments.service.ts
  - move/apps/api/src/modules/payments/jobs/reconcile-payments.job.ts
---
# Pago aprobado sin activar plan

Mercado Pago cobró pero el plan sigue inactivo: el webhook no llegó, falló a mitad
de camino o la activación quedó fuera de la transacción. El cliente pagó y no puede
reservar. Defensa activa: activación transaccional y conciliación periódica; un pago
tardío sin lugar queda marcado para el staff.
