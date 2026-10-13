---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/modules/users/entities/user.entity.ts
  - move/apps/api/src/common/auth/roles.decorator.ts
---
# Roles persistidos cliente y staff

Solo hay dos roles persistidos, `client` y `staff`; visitante es la ausencia de
sesión. Todo registro web crea un cliente; el staff se crea por CLI.

## Structural
- constrains → [[Usuario]]
- constrains → [[Modulo auth]]
