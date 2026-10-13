---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/checkout.service.ts
  - move/apps/web/src/components/checkout/guest-form.tsx
  - move/apps/api/test/checkout.e2e-spec.ts
---
# Cuenta se crea durante la reserva

Un visitante puede reservar y pagar Rehab o Recovery sin cuenta previa; el checkout
le crea el usuario. Si el email ya tiene cuenta, la API responde `LOGIN_REQUIRED` y la
web pide ingresar antes de seguir, para que nadie opere en nombre de otra cuenta
(D21).

## Structural
- constrains → [[Perfil Visitante]]
- constrains → [[Modulo auth]]
