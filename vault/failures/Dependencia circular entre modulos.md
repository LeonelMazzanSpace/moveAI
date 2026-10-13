---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
---
# Dependencia circular entre modulos

Dos módulos se importan entre sí (por ejemplo reservas ↔ pagos) y Nest no resuelve
los providers sin `forwardRef`; la lógica queda enredada. Defensa activa: orden fijo
de dependencias, sin `forwardRef`.
