---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/scripts/responsive/audit.mjs
  - move/docs/responsive-audit.md
---
# Auditoria responsive falla ante rutas inesperadas

`pnpm responsive:audit` (39 rutas × 4 anchos) marca como hallazgo `ruta-inesperada`
una respuesta con estado ≥ 400 o sin respuesta, y una URL final distinta de la pedida;
también falla si aparece el overlay de error de Next. Así una sesión vencida que
redirige a `/ingresar` o una página rota no cuentan como "OK" (T-065).

## Structural
- constrains → [[Monorepo MOVE]]
- prevents → [[Auditoria responsive aprueba rutas rotas]]
