---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/web/package.json
  - move/apps/web/src/components/auth/schemas.ts
  - move/apps/web/src/components/checkout/guest-form.schema.ts
---
# Formularios validados con Zod

Los formularios usan React Hook Form con schemas Zod junto al componente. Las
validaciones del front reflejan los rangos de los DTOs de la API, pero no los
reemplazan.

## Structural
- constrains → [[App web Next]]
