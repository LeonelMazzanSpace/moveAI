---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p15
  - move/apps/web/src/lib/api/types.ts
---
# Desalineacion entre front y back

Front y API implementan contratos distintos del mismo flujo y la integración se
rompe en la demo. Defensa activa: contrato HTTP del plan y tipos de la web en un solo
archivo.
