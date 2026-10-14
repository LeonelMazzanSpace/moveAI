---
type: screen
status: shipped
semana: 3
updated: 2026-10-14
source:
  - move/imagenes/htmls/08-panel-gestion.html
  - move/apps/web/src/app/staff/clientes/page.tsx
  - move/apps/web/src/app/staff/clientes/[id]/page.tsx
  - move/apps/web/src/components/staff/clientes/client-detail.tsx
---
# Pantalla clientes staff

Lista de clientes con búsqueda, KPIs, filtros por estado y tabla con plan,
vencimiento, pagos, última asistencia, frecuencia y uso de Rehab y Recovery. Suma el
detalle de cada cliente (historial, contactos, pausa, habilitar seguimiento) y el alta
manual.
La ficha del cliente muestra sus débitos automáticos y permite cancelarlos.

## Structural
- is part of → [[Panel staff web]]
- depends on → [[Modulo usuarios]]
- depends on → [[Modulo suscripciones]]
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo clientes]]
