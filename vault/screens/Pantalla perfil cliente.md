---
type: screen
status: shipped
semana: 2
updated: 2026-10-14
source:
  - move/imagenes/htmls/07-perfil-cliente.html
  - move/apps/web/src/app/(cliente)/perfil/page.tsx
  - move/apps/web/src/components/client/upcoming-bookings.tsx
  - move/apps/web/src/components/client/auto-debit-card.tsx
---
# Pantalla perfil cliente

Plan vigente con días restantes y renovar, paquetes, próximas reservas cancelables
(con aviso de pago pendiente), accesos rápidos, avisos y resumen del mes. El historial
completo va en su propia página. Las tarjetas de plan y de packs muestran el débito
automático activo con su próximo cobro y "Cancelar débito" con confirmación.

## Structural
- is part of → [[Area cliente web]]
- depends on → [[Modulo suscripciones]]
- depends on → [[Modulo reservas]]
- depends on → [[Modulo clientes]]
- depends on → [[Debito automatico]]
