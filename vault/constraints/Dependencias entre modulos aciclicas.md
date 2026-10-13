---
type: constraint
status: shipped
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
---
# Dependencias entre modulos aciclicas

Los módulos se importan en un solo orden fijo (configuración → notificaciones →
usuarios → auth → catálogo → agenda → suscripciones → reservas → pagos → seguimiento →
clientes → automatizaciones), sin `forwardRef`. Única excepción aceptada: imports solo
de tipo para relaciones ORM, sin import en runtime (D37).

## Structural
- constrains → [[API NestJS]]
- prevents → [[Dependencia circular entre modulos]]
