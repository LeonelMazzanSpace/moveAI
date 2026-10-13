---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p3
  - move/apps/api/src/common/time/business-time.ts
---
# ADR zona horaria de negocio

MOVE opera en Uruguay; todas las reglas de fecha se evalúan en `America/Montevideo`.
El PDF no lo dice explícitamente; el equipo lo confirmó (D11) y está aplicado en API y
web.

## Structural
- establishes → [[Fechas en zona horaria de Uruguay]]
