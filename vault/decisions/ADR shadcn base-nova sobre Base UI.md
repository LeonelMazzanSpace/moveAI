---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/apps/web/components.json
  - move/apps/web/src/lib/utils.ts
  - move/apps/web/package.json
---
# ADR shadcn base-nova sobre Base UI

shadcn v4 con el preset base-nova, que usa `@base-ui/react` en lugar de Radix y el
paquete oficial `cn`. Los componentes se agregan con el CLI de shadcn.

## Structural
- constrains → [[App web Next]]
- establishes → [[Estilos via tokens del tema]]
