---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/app.module.ts
---
# Dependencias entre modulos aciclicas

Los módulos se importan en un solo sentido, el que marcan sus aristas `depends on`
(por ejemplo pagos → suscripciones → catálogo, nunca al revés). Sin `forwardRef`: si
dos módulos se necesitan entre sí, la lógica compartida baja a un tercero.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Dependencia circular entre modulos]]
