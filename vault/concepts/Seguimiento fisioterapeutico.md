---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/clients/dto/rehab-followup.dto.ts
  - move/apps/web/src/components/booking/followup-booking.tsx
  - move/apps/web/src/app/(cliente)/reservar/fisioterapia/page.tsx
---
# Seguimiento fisioterapeutico

Resuelto (D6): el staff lo habilita por cliente después de la evaluación o al derivar
a Rehab, y el cliente habilitado reserva desde su perfil sobre la disponibilidad del
profesional, sin cobro online. Sin habilitación la API responde
`REHAB_FOLLOWUP_NOT_ENABLED`.

## Structural
- is part of → [[Servicio Rehab]]
- requires → [[Evaluacion y diagnostico]]
