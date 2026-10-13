---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p4
  - move/apps/api/src/modules/subscriptions/domain/vigencia.ts
---
# Dias de plan perdidos al renovar

Un cliente que renueva antes de vencer pierde los días que le quedaban porque el
nuevo período arranca el día del pago. Defensa activa: la renovación queda programada
desde el vencimiento.
