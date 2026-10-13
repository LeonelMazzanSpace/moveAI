---
type: system
status: built-off-by-default
semana: 1
updated: 2026-10-13
source:
  - move/apps/api/src/config/auth.config.ts
  - move/apps/api/src/modules/auth/better-auth.factory.ts
  - move/apps/web/src/components/auth/google-button.tsx
---
# Google OAuth

Proveedor social de Better Auth. Está integrado pero apagado hasta tener
credenciales: sin `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` la API no lo registra y
la web oculta el botón. Falta cargar las credenciales de MOVE y sus redirect URIs.
