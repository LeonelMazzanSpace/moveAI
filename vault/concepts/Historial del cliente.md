---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p2
  - move/apps/api/src/modules/clients/services/overview.service.ts
  - move/apps/web/src/app/(cliente)/historial/page.tsx
---
# Historial del cliente

Línea de tiempo única de un cliente con reservas, asistencias, cancelaciones,
pagos y contactos de los tres servicios. Consolidarla es el objetivo de negocio
explícito del MVP; la ven el cliente en su perfil y el staff en el detalle.

## Structural
- depends on → [[Reserva]]
- depends on → [[Asistencia]]
- depends on → [[Pago]]
- depends on → [[Contacto de seguimiento]]
