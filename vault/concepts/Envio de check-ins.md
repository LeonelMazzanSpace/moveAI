---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/automations/jobs/checkins-monthly.job.ts
  - move/apps/api/src/modules/followup/services/checkins.service.ts
---
# Envio de check-ins

Resuelto (D9): el staff lo envía a mano y además un job lo manda el primer lunes de
cada mes a las 10:00, por email con link al formulario del perfil. Destinatarios:
clientes con plan Performance vigente y sin pausa, como máximo uno por mes calendario.
Cada envío también manda la invitación a los check-ins del mes que nunca tuvieron
email (T-042), salvo a pausados o dados de baja; una invitación que falló no se
reintenta (decisión pendiente del usuario).

## Structural
- is part of → [[Check-in]]
