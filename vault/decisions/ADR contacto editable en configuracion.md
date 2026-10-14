---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/apps/api/src/modules/settings/dto/update-contact.dto.ts
  - move/apps/api/src/modules/settings/controllers/settings.controller.ts
  - move/apps/web/src/components/staff/config/contact-tab.tsx
  - move/apps/web/src/components/public/contact-section.tsx
  - move/apps/web/src/components/layout/public-footer.tsx
---
# ADR contacto editable en configuracion

D91 (con D106): dirección, horarios, WhatsApp, Instagram, email, link de Google Maps y
el email de avisos al staff se editan en Configuración → "Contacto" y se guardan en
`settings` como texto, aparte de las reglas operativas. Se muestran en el footer
público, en "Dónde estamos" del inicio y en el pie de cada mail; el endpoint público
nunca devuelve el email de avisos al staff. Sin mapa embebido.

## Structural
- establishes → [[Configuracion operativa administrada por staff]]
- constrains → [[Modulo configuracion]]
- constrains → [[Modulo notificaciones]]
- constrains → [[Area publica web]]
