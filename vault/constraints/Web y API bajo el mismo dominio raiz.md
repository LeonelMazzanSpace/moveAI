---
type: constraint
status: proposed
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
---
# Web y API bajo el mismo dominio raiz

Web (Vercel) y API (Elastic Beanstalk) se publican bajo el mismo dominio raíz
(por ejemplo `move.uy` y `api.move.uy`) para que la cookie de sesión sea first-party.
Depende de dónde corra Better Auth.

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- prevents → [[Sesion no viaja entre web y API]]
