---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/apps/api/src/modules/payments/services/mercado-pago.service.ts
---
# Logica de negocio acoplada al proveedor

Las reglas de vigencia o confirmación dependen de datos o configuración de
Mercado Pago o Brevo. Cambiar o caer el proveedor rompe el dominio. Defensa activa:
un service por proveedor y reglas en MOVE.
