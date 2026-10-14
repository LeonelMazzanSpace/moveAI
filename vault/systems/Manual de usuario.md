---
type: system
status: shipped
updated: 2026-10-14
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

Manual en Markdown y PDF para clientes, staff y equipo técnico: una guía destacada
"Probar MOVE en local" con los usuarios de demo, estado actual frente a MOVE.pdf, una
captura de cada pantalla en escritorio y en celular, deuda conocida, cómo levantar todo,
diagrama de arquitectura y la guía de cada proveedor. Desde la tanda de comentarios del
cliente (T-068) cubre también pago único o débito automático, los emails, el contacto
editable, Google Calendar, la auditoría responsive y una "prueba real" con credenciales
para Mercado Pago, Google Calendar y Brevo. Se regenera con scripts que cargan datos de
demo, capturan con Playwright y publican las imágenes solo si salieron todas.

### Structural
- is part of → [[Monorepo MOVE]]
- depends on → [[App web Next]] because captura las pantallas reales
- depends on → [[API NestJS]] because carga los datos de demo por HTTP
