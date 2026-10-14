---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/web/src/components/move/radio-styles.ts
  - move/apps/web/src/components/move/radio-styles.test.ts
  - move/apps/web/src/components/checkout/plan-checkout.test.tsx
  - move/apps/web/src/components/client/checkin-form.test.tsx
---
# Radio nativo se lee al reves en el tema oscuro

Con el tema oscuro, el radio nativo pintado con `accent-primary` se ve como un disco
blanco lleno cuando no está elegido y como un anillo cuando sí, así que la elección
del modo de pago y del check-in se leía al revés. Se vio en las capturas del manual
(observación de T-068). Los tests fijan las clases del radio propio y el resaltado de
la tarjeta elegida. Queda abierto: los checkboxes de staff siguen con `accent-primary`
y podrían tener el mismo problema (review T-072, m-4).
