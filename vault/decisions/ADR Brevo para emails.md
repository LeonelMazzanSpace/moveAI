---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
  - move/apps/api/src/modules/notifications/services/brevo.service.ts
---
# ADR Brevo para emails

Las comunicaciones salen por el Brevo de MOVE, integrado desde NestJS por su API
REST. Pisa el default de SpaceDev (Resend) para no sumar otro proveedor. Hasta tener
la clave corre en dry-run.

## Structural
- constrains → [[Modulo notificaciones]]
- establishes → [[Integraciones externas encapsuladas en un servicio]]
