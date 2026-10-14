---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/src/lib/api/field-errors.ts
  - move/apps/web/src/components/staff/shared/inactivity-reason-form.tsx
---
# Mensajes de validacion en ingles visibles

Los formularios de staff mostraban bajo el campo el texto crudo de la API, por ejemplo
"cancelLimitHours must not be greater than 48", cuando el cliente aceptaba un valor que
la API rechazaba (reviews de T-046 y T-047, I-1). Los tests lo fijaban porque mockeaban
mensajes ya en español.
