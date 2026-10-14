---
type: screen
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/apps/web/src/app/(cliente)/checkout/plan/[slug]/page.tsx
  - move/apps/web/src/app/(public)/checkout/resultado/page.tsx
  - move/apps/web/src/components/checkout/payment-result.tsx
  - move/apps/web/src/components/checkout/plan-checkout.tsx
  - move/apps/web/src/components/checkout/auto-debit-result.tsx
---
# Pantalla checkout de pago

Checkout de plan y página de resultado, sin mockup (derivadas del sistema visual,
D12). El resultado consulta a la API el estado real de la compra durante un minuto y
después muestra "Pago en proceso", con la opción de reintentar un plan rechazado. Si
el plan lo permite, el checkout ofrece "Pago único" o "Débito automático"; con débito
de Performance activo no deja comprar. `?debito=<ref>` muestra el estado del débito.

## Structural
- is part of → [[Area publica web]]
- depends on → [[Modulo pagos]]
- depends on → [[Debito automatico]]
