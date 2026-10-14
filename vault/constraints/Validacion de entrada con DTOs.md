---
type: constraint
status: shipped
semana: 1
updated: 2026-10-14
source:
  - move/apps/api/src/app.setup.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
---
# Validacion de entrada con DTOs

`ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`; cada
endpoint recibe un DTO de class-validator con cota superior en todo número y largo
(D38). Un body de más de 1 MB responde 400, y el registro de Better Auth valida sus
campos en un hook propio. La API solo parsea JSON: un POST form-encoded a una ruta
Nest responde 400 (T-039).
Los textos y emails además rechazan surrogates UTF-16 sueltos (D117).

## Structural
- constrains → [[API NestJS]]
- prevents → [[Datos invalidos en la base]]
