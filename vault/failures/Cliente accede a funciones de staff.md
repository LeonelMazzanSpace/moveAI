---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/apps/api/src/modules/auth/guards/auth.guard.ts
  - move/apps/api/test/auth.e2e-spec.ts
---
# Cliente accede a funciones de staff

Un usuario con rol cliente llama endpoints de staff (marcar asistencia, ver
clientes, editar planes) o lee datos de otro cliente. Defensa activa: guard global de
rol y filtros por dueño del recurso.
