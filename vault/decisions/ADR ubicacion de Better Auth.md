---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/auth/mount-auth.ts
  - move/apps/api/src/modules/auth/guards/auth.guard.ts
---
# ADR ubicacion de Better Auth

Resuelta el 2026-10-13 (D2): Better Auth se monta dentro de la API Nest en
`/api/auth/*` con su handler de Node, sin librería puente, y un guard global propio
valida la sesión. Auth queda junto al dominio; a cambio, web y API tienen que compartir
dominio raíz para la cookie.

## Structural
- establishes → [[Web y API bajo el mismo dominio raiz]]
- constrains → [[Modulo auth]]
