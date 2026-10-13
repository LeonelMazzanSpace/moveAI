---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/src/app/server-client-boundary.test.ts
  - move/apps/web/src/app/staff/pagos/page.tsx
  - move/apps/web/src/lib/pagination.ts
---
# Helper de modulo use client rompe un Server Component

Una página de servidor importaba una función exportada desde un módulo `'use client'`;
en runtime la recibe como referencia de cliente y la página responde 500, aunque
`next build` pase. Así cayó `/staff/pagos`, y apareció recién al capturar el manual
(T-028 → T-035). Fix: el helper pasó a `lib/pagination.ts` y un test de frontera
detecta ese tipo de import.
