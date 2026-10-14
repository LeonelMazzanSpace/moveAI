---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/web/src/components/layout/mobile-nav.tsx
  - move/apps/web/src/components/staff/shared/mobile-card.ts
  - move/e2e/fixtures.ts
  - move/scripts/responsive/audit.mjs
---
# Pantallas sin scroll horizontal en mobile

A 375 px ninguna pantalla de las tres áreas tiene scroll horizontal de página: la
navegación pasa a un menú móvil y las tablas de staff con acciones (turnos, pagos) se
muestran como tarjetas con las acciones a la vista. Las tablas convertidas conservan
roles ARIA y el orden de lectura. Desde T-065 lo verifica también
`pnpm responsive:audit` a 375, 768, 1024 y 1440 px (0 hallazgos); los valores largos
de texto libre usan `[overflow-wrap:anywhere]` con `min-w-0` (T-071).

## Structural
- constrains → [[App web Next]]
- mitigates → [[UI inconsistente con el diseno]]
