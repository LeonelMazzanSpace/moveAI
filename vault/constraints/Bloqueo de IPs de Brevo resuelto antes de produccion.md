---
type: constraint
status: draft
semana: 4
updated: 2026-10-13
source:
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
  - move/apps/api/src/modules/notifications/services/brevo.service.ts
---
# Bloqueo de IPs de Brevo resuelto antes de produccion

Brevo puede activar solo el bloqueo de IPs desconocidas para las API keys, y cada
instancia nueva de Elastic Beanstalk sale con otra IP. Antes de producción hay que
decidir: desactivar ese bloqueo para la API key o dar a la API una IP de salida fija.
Además Brevo desactiva una key tras 90 días sin llamadas exitosas, así que una key de
dev quieta hay que revisarla antes de probar.

## Structural
- constrains → [[Brevo]]
- prevents → [[Emails bloqueados por IP nueva en Brevo]]
