---
type: concept
status: shipped
updated: 2026-11-12
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/globals.css
  - move/apps/web/src/app/(public)/page.tsx
---
# Sistema visual MOVE

Estética de los mockups: modo oscuro puro con fondos en escala de grises, Archivo
800–900 en mayúsculas para títulos, Inter para texto, etiquetas con tracking amplio y
radio chico. Estados en verde, ámbar y rojo con fondo tenue. Está cargado como tokens
del tema en `globals.css`.

La landing (`/`) usa una variante rojo y negro: se envuelve en `.theme-landing`, que
redefine `primary`, `ring`, `card`, `soft` y `border` con tonos rojos; el resto de las
pantallas, incluidos el header y el footer compartidos, sigue en blanco sobre negro.

## Structural
- constrains → [[App web Next]]
