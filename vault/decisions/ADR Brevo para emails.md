---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# ADR Brevo para emails

Las comunicaciones salen por el Brevo existente, integrado desde NestJS. Pisa el
default de SpaceDev (Resend) para no sumar otro proveedor.

## Structural
- constrains → [[Modulo notificaciones]]
- establishes → [[Integraciones externas encapsuladas en un servicio]]
