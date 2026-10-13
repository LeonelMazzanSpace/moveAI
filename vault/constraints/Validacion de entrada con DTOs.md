---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/main.ts
---
# Validacion de entrada con DTOs

`ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`, ya
activo. Regla: cada endpoint nuevo recibe un DTO de class-validator; el pipe rechaza
propiedades desconocidas. Todavía no hay DTOs de dominio.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Datos invalidos en la base]]
