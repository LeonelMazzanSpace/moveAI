---
type: system
status: shipped
updated: 2026-10-13
source:
  - move/docs/manual/manual-de-usuario.md
  - move/docs/manual/manual-de-usuario.pdf
  - move/docs/manual/arquitectura.html
  - move/scripts/manual/capture.mjs
  - move/scripts/manual/demo-data.mjs
  - move/scripts/manual/build-pdf.mjs
  - move/scripts/manual/render-diagram.mjs
---
# Manual de usuario

Manual en Markdown y PDF para clientes, staff y equipo técnico: estado actual frente
a MOVE.pdf, una captura de cada pantalla, cómo levantar todo, diagrama de
arquitectura y la guía de cada proveedor (Neon, Elastic Beanstalk, Vercel, dominio,
Mercado Pago, Google, Brevo, Bitbucket). Se regenera con scripts que cargan datos de
demo (por la API y por `psql` en el contenedor de desarrollo), capturan con
Playwright, renderizan el diagrama y arman el PDF.

## Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[App web Next]] because captura las pantallas reales
- depends on → [[API NestJS]] because carga los datos de demo por HTTP
