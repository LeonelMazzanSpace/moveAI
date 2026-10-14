---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/test/auto-debits-webhook.e2e-spec.ts
---
# Debito reemplazado cobrado en paralelo

Al iniciar un débito nuevo, el `pending` anterior se cerraba en MOVE y se cancelaba en
Mercado Pago "si se podía". Si MP fallaba, nadie lo volvía a intentar: el cliente podía
autorizar ambos desde dos pestañas, MP cobraba los dos cada mes y MOVE no permitía
cancelar el viejo (review T-062, I-1).

## Structural
- causes → [[Vigencia extendida dos veces]]
