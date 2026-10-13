---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/payments/controllers/checkout.controller.ts
  - move/apps/api/src/app.module.ts
  - move/apps/api/test/hold-limits.e2e-spec.ts
---
# Checkout publico limitado por IP

Iniciar un checkout está limitado por IP: 10 por minuto en reservas y planes, y además
20 por hora en reservas; el exceso responde 429 `RATE_LIMITED`. El contador vive en
memoria de cada instancia, así que con varias instancias el límite efectivo se
multiplica.

## Structural
- constrains → [[Modulo pagos]]
- requires → [[IP real del cliente detras del proxy]] because sin la IP real todos comparten un contador
- mitigates → [[Retenciones masivas de invitados]]
