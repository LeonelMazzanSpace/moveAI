---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/docs/deploy.md
---
# ADR sin deploy en el run del MVP

D51, decidida por el usuario: en este run no se despliega a ninguna infraestructura;
todo corre local y el runbook de deploy queda como referencia de los pasos que faltan.

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- constrains → [[Vercel]]
- constrains → [[Neon Postgres]]
