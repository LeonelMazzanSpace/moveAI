---
type: screen
status: shipped
semana: 3
updated: 2026-10-14
source:
  - move/imagenes/htmls/06-recovery.html
  - move/apps/web/src/app/(public)/recovery/page.tsx
  - move/apps/web/src/components/checkout/recovery-booking-flow.tsx
  - move/apps/web/src/components/public/recovery-room-section.tsx
---
# Pantalla Recovery

Recovery Room: sesión individual y paquetes de sesiones, más el flujo selección →
reserva → pago → confirmación. Abierta al público general sin plan previo; con
paquete vigente la reserva consume una sesión sin pago. Entre el hero y las
modalidades está la sección "Recovery Room by MOVE" (`#recovery-room`): texto, tres
fotos y cinco equipos.

## Structural
- is part of → [[Area publica web]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo reservas]]
- depends on → [[Modulo pagos]]
- depends on → [[Modulo notificaciones]] because email de confirmación
