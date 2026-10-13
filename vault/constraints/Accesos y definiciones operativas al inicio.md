---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p19
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/settings/settings.defaults.ts
  - move/apps/api/src/database/seed-data.ts
---
# Accesos y definiciones operativas al inicio

El plan supone acceso desde el día 1 a Vercel, Neon, Brevo, Mercado Pago, Google
OAuth y AWS, y las definiciones de planes, horarios, cupos y reglas. Al 2026-10-13
siguen sin llegar: el equipo avanzó con simulador de pagos, Brevo en dry-run y valores
del mockup como semilla provisoria (D4, D10), así que ya no bloquea la construcción
pero sí la puesta en producción.

## Structural
- constrains → [[Modulo catalogo]] because precios y planes reales
- constrains → [[Modulo agenda]] because horarios y cupos reales
- prevents → [[Retraso por accesos e insumos faltantes]]
