---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/followup/services/alerts.service.ts
  - move/apps/api/src/modules/notifications/services/notifications.service.ts
  - move/apps/api/test/automations.e2e-spec.ts
---
# Jobs programados idempotentes

Correr un job dos veces el mismo día no crea alertas ni emails repetidos: cada alerta
tiene clave única por cliente, tipo y período, y cada email deja antes su fila en
`email_logs` con clave de idempotencia. Confirmada por el equipo (D11).

## Structural
- constrains → [[Modulo automatizaciones]]
- prevents → [[Alertas o emails duplicados]]
