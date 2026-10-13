---
type: concept
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Webhook de Mercado Pago

Notificación asíncrona con la que Mercado Pago informa el cambio de estado de un
pago. Puede llegar repetida, fuera de orden o no llegar, y cualquiera puede llamar al
endpoint público.

## Structural
- is part of → [[Modulo pagos]]
- enables → [[Webhook duplicado procesado dos veces]]
- enables → [[Webhook falsificado]]
- enables → [[Pago aprobado sin activar plan]] because si la notificación nunca llega o falla a mitad
