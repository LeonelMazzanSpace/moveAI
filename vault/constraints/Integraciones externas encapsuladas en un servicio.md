---
type: constraint
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
  - move/apps/api/src/modules/notifications/services/brevo.service.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# Integraciones externas encapsuladas en un servicio

Estándar SpaceDev, más el pedido del PDF de usar Mercado Pago solo como procesador.
Mercado Pago y Brevo se llaman por REST con `fetch` desde un único service cada uno,
sin SDK (D17), y la instancia de Better Auth vive solo en el módulo auth. Sin
interfaces ni adaptadores.

## Structural
- constrains → [[Modulo pagos]]
- constrains → [[Modulo notificaciones]]
- mitigates → [[Logica de negocio acoplada al proveedor]]
