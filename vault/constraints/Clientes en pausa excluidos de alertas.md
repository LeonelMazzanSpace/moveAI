---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/followup/domain/alert-rules.ts
  - move/apps/api/src/modules/followup/services/inactivity.service.ts
  - move/apps/api/src/modules/followup/services/alerts.service.ts
  - move/apps/api/test/alerts.e2e-spec.ts
---
# Clientes en pausa excluidos de alertas

Un cliente con pausa activa (motivo de inactividad vigente) no dispara alertas de
inactividad, frecuencia ni vencimiento, ni recibe emails automáticos. Solo dispara la
alerta de re-contacto en la fecha pedida. Confirmada por el equipo (D11). Desde T-042
la pausa se vuelve a chequear dentro del `INSERT … SELECT` de alertas, así una pausa
creada durante la detección ya no deja pasar una alerta.

## Structural
- constrains → [[Alerta de seguimiento]]
- constrains → [[Modulo automatizaciones]]
- prevents → [[Alertas de inactividad falsas]]
- prevents → [[Email automatico indebido al cliente]]
