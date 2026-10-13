---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/followup/domain/checkin-rules.ts
  - move/apps/api/src/modules/followup/services/checkins.service.ts
  - move/apps/api/test/checkins.e2e-spec.ts
---
# Check-in con molestia genera alerta

Una respuesta de check-in con molestia o con cambio de objetivos crea una alerta de
intervención para el staff (la molestia tiene prioridad). Molestia: Contactar o
Derivar a Rehab. Cambio de objetivos: Contactar o Marcar gestionado.

## Structural
- constrains → [[Check-in]]
- prevents → [[Molestia reportada sin intervencion]]
