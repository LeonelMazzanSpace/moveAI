---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p13
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
---
# Ambientes dev y produccion separados

Hay ambientes separados de desarrollo y producción, con bases, roles, credenciales,
claves de proveedores, URLs y cookies distintas. Nada se desplegó en el MVP (D51), así
que hoy solo existe el ambiente local.

## Structural
- constrains → [[Vercel]]
- constrains → [[AWS Elastic Beanstalk]]
- constrains → [[Neon Postgres]]
- requires → [[Ambiente dev en dominio registrable propio]] because las previews automáticas no llegan a la API de dev
