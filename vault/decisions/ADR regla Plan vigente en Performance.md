---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/apps/web/src/app/(public)/performance/page.tsx
  - move/apps/web/src/app/(public)/performance/performance-rule.test.tsx
---
# ADR regla Plan vigente en Performance

D92: el comentario "aparece que tengo el PLAN VENCIDO" lo causaba una caja fija de
`/performance` titulada "Plan vencido:", que cualquier visitante veía aunque tuviera
plan activo. Se reescribió como regla ("Plan vigente: …"), sin cambios en la API. El
aviso de estado real sigue saliendo solo tras un rechazo `PLAN_REQUIRED`, que aplica
[[Reserva Performance requiere plan vigente]].

## Structural
- constrains → [[Pantalla Performance]]
