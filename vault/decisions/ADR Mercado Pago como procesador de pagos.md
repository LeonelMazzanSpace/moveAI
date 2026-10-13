---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# ADR Mercado Pago como procesador de pagos

Se reutiliza la cuenta de Mercado Pago de MOVE, adaptada a los flujos de
Performance, Rehab y Recovery. El backend crea y valida los pagos; la lógica de
negocio queda en MOVE.

## Structural
- establishes → [[Logica de negocio fuera de Mercado Pago]]
- establishes → [[Pago confirmado solo por webhook validado]]
- establishes → [[Operaciones de pago idempotentes]]
- establishes → [[Activacion en la misma transaccion que el pago]]
- establishes → [[Conciliacion periodica de pagos pendientes]]
- constrains → [[Modulo pagos]]
