---
type: system
status: shipped
semana: 2
updated: 2026-10-13
source:
  - move/apps/web/src/app/(cliente)/layout.tsx
  - move/apps/web/src/app/(cliente)/perfil/page.tsx
  - move/apps/web/src/app/(cliente)/historial/page.tsx
  - move/apps/web/src/lib/auth/session.ts
---
# Area cliente web

Rutas autenticadas del cliente: perfil con plan y vencimiento, checkout de plan,
reserva de seguimiento fisioterapéutico, historial, check-in y avisos. El layout
exige sesión de cliente; sin sesión manda a ingresar con la ruta exacta como `next`.

## Structural
- is part of → [[App web Next]]
- depends on → [[Modulo auth]]
