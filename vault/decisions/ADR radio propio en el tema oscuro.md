---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/components/move/radio-styles.ts
  - move/apps/web/src/components/checkout/plan-checkout.tsx
  - move/apps/web/src/components/client/checkin-form.tsx
---
# ADR radio propio en el tema oscuro

D123 (T-072): las opciones de radio de MOVE no usan el radio nativo pintado con
`accent-primary`. `RADIO_CLASS` dibuja el círculo con tokens del tema: anillo apagado
sin elegir, anillo claro con punto interior al elegir. Además, la tarjeta de la opción
elegida se resalta con borde. Se aplica a "Pago único" / "Débito automático" del
checkout y a las respuestas del check-in.

## Structural
- constrains → [[Sistema visual MOVE]]
- constrains → [[Pantalla checkout de pago]]
- constrains → [[Pantalla check-in]]
- prevents → [[Radio nativo se lee al reves en el tema oscuro]]
