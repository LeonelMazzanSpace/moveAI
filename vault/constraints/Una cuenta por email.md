---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/auth/better-auth.factory.ts
  - move/apps/api/src/modules/payments/services/checkout.service.ts
  - move/apps/web/src/components/auth/login-form.tsx
---
# Una cuenta por email

El email es único por usuario. El checkout de invitado con un email existente pide
ingresar, y Google se vincula a la cuenta existente solo si su email ya está
verificado; si no, la web explica que hay que ingresar con contraseña (D40).
Confirmada por el equipo (D11).

## Structural
- constrains → [[Usuario]]
- prevents → [[Cuentas duplicadas por email]]
