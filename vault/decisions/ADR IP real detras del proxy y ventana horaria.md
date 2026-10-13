---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/app.setup.ts
  - move/apps/api/src/app.module.ts
  - move/docs/deploy.md
---
# ADR IP real detras del proxy y ventana horaria

D58, del review de T-031: `TRUST_PROXY_HOPS` (0 a 5, default 0, nunca `true`) para que
el throttling vea la IP real detrás del ALB y Nginx, una segunda ventana de 20 por hora
por IP en el checkout de reservas contra invitados con emails nuevos, y docs de deploy
sobre el proxy y el throttler en memoria por instancia.

## Structural
- establishes → [[IP real del cliente detras del proxy]]
- establishes → [[Checkout publico limitado por IP]]
