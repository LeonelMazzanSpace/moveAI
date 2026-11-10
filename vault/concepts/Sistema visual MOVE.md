---
type: concept
status: shipped
updated: 2026-11-10
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/globals.css
---
# Sistema visual MOVE

Estética de los mockups: modo oscuro puro con fondos en escala de grises, Archivo
800–900 en mayúsculas para títulos, Inter para texto, etiquetas con tracking amplio y
radio chico. Estados en verde, ámbar y rojo con fondo tenue. Está cargado como tokens
del tema en `globals.css`.

El sitio público (grupo `(public)`, la landing incluida) usa una variante roja y negra:
la clase `.theme-red`, aplicada en su layout, redefine los mismos tokens (`primary`
rojo, fondos y bordes con tinte rojizo y `brand` para las etiquetas). Las áreas de
cliente, auth y staff siguen en la escala de grises.

## Structural
- constrains → [[App web Next]]
