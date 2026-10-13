---
type: constraint
status: proposed
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Operaciones de pago idempotentes

Procesar la misma notificación dos veces no tiene efecto extra: se guarda el ID de
pago de Mercado Pago con una restricción única y se ignoran las transiciones de
estado ya aplicadas.

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Webhook duplicado procesado dos veces]]
