---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/app.module.ts
  - move/apps/api/src/modules/notifications/services/notifications.service.ts
  - move/apps/api/src/config/auth.config.ts
---
# ADR desarrollo sin accesos a proveedores

D4, decidida por el usuario el 2026-10-13: como no hay accesos a proveedores, el MVP
se construye contra Postgres en Docker, con Google OAuth opcional por entorno, un
simulador de pagos solo para desarrollo cuando falta `MP_ACCESS_TOKEN` y Brevo en
dry-run sin `BREVO_API_KEY`. El deploy queda fuera del run, con runbook.

## Structural
- establishes → [[Simulador de pagos solo fuera de produccion]]
- constrains → [[Mercado Pago]]
- constrains → [[Brevo]]
- constrains → [[Google OAuth]]
