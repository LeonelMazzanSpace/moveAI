---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/auth/services/auth.service.ts
  - move/apps/api/test/auth.e2e-spec.ts
---
# ADR invitacion de 72 horas

D71, decidida por el usuario: el link de invitación (cliente creado por staff, invitado
del checkout, o cuenta sin contraseña que pide "Olvidé mi contraseña", incluidas las
solo-Google) dura 72 horas; el restablecimiento de contraseña sigue en 1 hora. Si
extender el link falla, la invitación sale igual con 1 hora (T-051).

## Structural
- constrains → [[Modulo auth]]
- constrains → [[Better Auth]]
