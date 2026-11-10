---
type: concept
status: shipped
updated: 2026-11-10
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/globals.css
  - move/apps/web/src/components/move/eyebrow.tsx
---
# Sistema visual MOVE

Estética de los mockups: modo oscuro puro con fondos en escala de grises, Archivo
800–900 en mayúsculas para títulos, Inter para texto, etiquetas con tracking amplio y
radio chico. Estados en verde, ámbar y rojo con fondo tenue. Está cargado como tokens
del tema en `globals.css`.

La landing (home) es la excepción: roja y negra. La página renderiza un marcador
`.landing-red` y `:root:has(.landing-red)` remapea los tokens (primary, ring, bordes,
cards) a rojo sobre negro, de modo que el header y el footer compartidos la acompañan.
El token `--brand` pinta las etiquetas (eyebrows): gris en el resto del sitio, rojo en
la landing. El resto de las pantallas sigue en blanco y negro.

## Structural
- constrains → [[App web Next]]
