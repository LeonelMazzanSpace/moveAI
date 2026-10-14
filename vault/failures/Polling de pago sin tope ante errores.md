---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/src/components/checkout/payment-result.tsx
  - move/apps/web/src/components/checkout/payment-result.test.tsx
---
# Polling de pago sin tope ante errores

La página de resultado del checkout contaba solo las respuestas exitosas para su tope
de 20 consultas: si la API caía después de un `pending`, seguía consultando cada 3
segundos para siempre, sin error ni "Pago en proceso" (review de T-045, I-1). Fix: el
tope cuenta éxitos y errores, y un error transitorio no oculta el último estado.
