---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p5
  - move/apps/api/src/modules/payments/services/checkout.service.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# Cuentas duplicadas por email

La misma persona termina con dos usuarios (uno por Google, otro creado al reservar
sin cuenta). Defensa activa: email único, `LOGIN_REQUIRED` en el checkout y Google
vinculado solo a cuentas verificadas.

## Structural
- causes → [[Historial del cliente fragmentado]]
