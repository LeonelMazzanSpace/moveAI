---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
  - move/apps/api/src/modules/payments/services/payments.service.ts
---
# ADR Mercado Pago como procesador de pagos

Se reutiliza la cuenta de Mercado Pago de MOVE para Performance, Rehab y Recovery. El
backend crea las preferencias y valida los pagos; la lógica de negocio queda en MOVE.
Implementado contra un simulador hasta tener credenciales.

## Structural
- establishes → [[Logica de negocio fuera de Mercado Pago]]
- establishes → [[Pago confirmado solo por webhook validado]]
- establishes → [[Operaciones de pago idempotentes]]
- establishes → [[Activacion en la misma transaccion que el pago]]
- establishes → [[Conciliacion periodica de pagos pendientes]]
- constrains → [[Modulo pagos]]
