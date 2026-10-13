---
type: constraint
status: todo
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# Integraciones externas encapsuladas en un servicio

Estándar SpaceDev, más el pedido del PDF de usar Mercado Pago "exclusivamente" como
procesador. Cada SDK de proveedor (Mercado Pago, Brevo, Better Auth) se usa desde un
único service dedicado de su módulo (por ejemplo `mercado-pago.service.ts`); el resto
del código nunca importa el SDK. Sin interfaces ni adaptadores.

## Structural
- constrains → [[Modulo pagos]]
- constrains → [[Modulo notificaciones]]
- mitigates → [[Logica de negocio acoplada al proveedor]]
