---
type: screen
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/imagenes/htmls/10-checkin-clientes.html
  - move/apps/web/src/app/(cliente)/check-in/page.tsx
  - move/apps/web/src/app/staff/seguimiento/check-in/page.tsx
---
# Pantalla check-in

Dos caras: el formulario del alumno (cómo se siente, molestia con detalle, cambio de
objetivos) y la vista staff con enviados, respondidos y los que requieren
intervención; Derivar a Rehab solo aparece ante una molestia.

## Structural
- is part of → [[Panel staff web]]
- is part of → [[Area cliente web]] because el formulario lo responde el alumno
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo notificaciones]] because envío del check-in
