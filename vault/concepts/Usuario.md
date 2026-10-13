---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p9
  - move/apps/api/src/modules/users/entities/user.entity.ts
---
# Usuario

Persona con cuenta en MOVE, cliente o staff. Su identidad (email, contraseña,
Google) la maneja Better Auth sobre la misma tabla; el resto del dominio (perfil, rol,
historial) cuelga del usuario.

## Structural
- is part of → [[Modulo usuarios]]
