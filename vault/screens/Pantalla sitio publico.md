---
type: screen
status: shipped
semana: 1
updated: 2026-10-14
source:
  - move/imagenes/htmls/01-sitio-publico.html
  - move/apps/web/src/app/(public)/page.tsx
  - move/apps/web/src/components/public/hero.tsx
  - move/apps/web/src/components/public/team-section.tsx
  - move/apps/web/src/components/public/contact-section.tsx
  - move/apps/web/src/components/layout/public-footer.tsx
---
# Pantalla sitio publico

Home pública con navbar, hero, cards de los tres servicios, planes destacados que
salen del catálogo, CTA de cuenta y footer. También hay una página de planes. Desde la
tanda de comentarios suma la sección "Equipo" (`#equipo`, enlazada en el nav) y
"Dónde estamos" al final; el footer muestra el bloque de contacto, y ambos desaparecen
sin error si la API no responde.

## Structural
- is part of → [[Area publica web]]
- depends on → [[Modulo catalogo]]
- depends on → [[Modulo configuracion]] because los datos de contacto salen de settings
