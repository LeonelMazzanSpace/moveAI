---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/apps/api/src/modules/notifications/templates/index.ts
  - move/apps/api/src/modules/notifications/templates/layout.ts
  - move/apps/api/src/modules/bookings/services/booking-emails.service.ts
  - move/apps/api/src/modules/automations/jobs/booking-reminders.job.ts
  - move/apps/api/src/cli/emails-preview.ts
---
# ADR mails nuevos y pie de contacto

D93, D102 y D103: cuatro mails nuevos de reserva (cancelada por el cliente, no
confirmada, recordatorio del día anterior a las 18:00 solo para Rehab y Recovery
—también a clientes en pausa, porque es transaccional— y aviso de Rehab al staff), más
cuatro de calendario y débito, para 17 plantillas. Todas llevan pie con los datos de
contacto, leídos de `settings` al enviar. Los avisos al staff van a una sola dirección;
vacía, no se envía ni se registra nada. `emails:preview` renderiza todas sin red ni base.

## Structural
- constrains → [[Modulo notificaciones]]
- constrains → [[Modulo reservas]]
- constrains → [[Modulo automatizaciones]]
