---
type: constraint
status: draft
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p19
---
# Accesos y definiciones operativas al inicio

El plan supone acceso desde el día 1 a Vercel, Neon, Brevo, Mercado Pago, Google
OAuth y AWS, y las definiciones de planes, horarios, cupos y reglas de cancelación.
Al 2026-10-13 no hay evidencia en el repo de que estén disponibles. Mientras tanto
se puede avanzar con los valores del mockup como datos semilla, marcados como
provisorios.

## Structural
- constrains → [[Modulo catalogo]] because precios y planes reales
- constrains → [[Modulo agenda]] because horarios, cupos y límite de cancelación
- prevents → [[Retraso por accesos e insumos faltantes]]
