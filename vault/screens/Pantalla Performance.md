---
type: screen
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/imagenes/htmls/03-performance.html
  - move/apps/web/src/app/(public)/performance/page.tsx
  - move/apps/web/src/components/booking/performance-schedule.tsx
---
# Pantalla Performance

Página del servicio con los planes de período y la grilla de turnos del día con
ocupación `n / cupo`, botón Reservar o "Completo". Sin plan vigente muestra el bloqueo
con el llamado a contratar o renovar.

## Structural
- is part of → [[Area publica web]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo reservas]]
