---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/common/validation/well-formed.ts
  - move/apps/api/src/modules/settings/dto/update-contact.dto.ts
  - move/apps/api/src/modules/clients/dto/create-client.dto.ts
  - move/apps/api/src/modules/payments/dto/checkout-booking.dto.ts
  - move/apps/api/src/modules/users/dto/update-me.dto.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# Textos y emails bien formados en la API

Los campos de texto y email que escribe un usuario (contacto, alta de clientes,
invitado del checkout, registro, `PATCH /api/me`) rechazan un surrogate UTF-16 suelto
con 400 `VALIDATION_FAILED`, mediante los decoradores compartidos de
`common/validation/well-formed.ts` (D117, D120). En los emails el chequeo corre antes
de `isEmail`. Un par válido, como un emoji, se acepta.

## Structural
- is a case of → [[Validacion de entrada con DTOs]]
- constrains → [[API NestJS]]
- prevents → [[Surrogate suelto responde 500]]
