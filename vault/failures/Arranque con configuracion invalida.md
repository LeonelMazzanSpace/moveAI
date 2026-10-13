---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/config/env.validation.ts
---
# Arranque con configuracion invalida

La API arranca sin una variable crítica y falla recién en runtime. Defensa activa
desde el 2026-10-13: validación de env al iniciar.
