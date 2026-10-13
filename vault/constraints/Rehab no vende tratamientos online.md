---
type: constraint
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/web/src/components/checkout/rehab-booking-flow.tsx
  - move/apps/api/src/modules/bookings/domain/booking-rules.ts
---
# Rehab no vende tratamientos online

La web solo vende la Evaluación y Diagnóstico. El tratamiento posterior lo define el
equipo; el seguimiento fisioterapéutico se reserva sin cobro online y solo si el staff
lo habilitó para ese cliente (D6).

## Structural
- constrains → [[Servicio Rehab]]
- prevents → [[Tratamiento vendido sin evaluacion]]
