---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/components/checkout/payment-result.tsx
---
# ADR reintento visible para plan rechazado

D46, del review de T-017 y aplicada en T-033: como un plan con pago rechazado sigue
pendiente, la página de resultado, al terminar de consultar, avisa que si el pago fue
rechazado se puede intentar de nuevo y ofrece volver al checkout de ese plan.

## Structural
- requires → [[ADR pago de plan rechazado deja la compra pendiente]]
- constrains → [[Pantalla checkout de pago]]
