---
type: screen
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/imagenes/htmls/05-rehab.html
  - move/apps/web/src/app/(public)/rehab/page.tsx
  - move/apps/web/src/components/checkout/rehab-booking-flow.tsx
---
# Pantalla Rehab

Reserva de Evaluación y Diagnóstico con stepper (evaluación → fecha y horario → pago
→ confirmación), selector semanal y turnos libres del profesional. Explica que el
tratamiento posterior lo define el equipo.

## Structural
- is part of → [[Area publica web]]
- depends on → [[Modulo agenda]]
- depends on → [[Modulo reservas]]
- depends on → [[Modulo pagos]]
- depends on → [[Modulo notificaciones]] because email de confirmación
