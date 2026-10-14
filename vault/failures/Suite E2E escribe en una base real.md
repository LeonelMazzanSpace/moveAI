---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/scripts/e2e/env.mjs
  - move/e2e/support/sql.ts
---
# Suite E2E escribe en una base real

La primera versión de la suite solo validaba el nombre de la base en el reset: con
`E2E_DB_NAME=move` la API de pruebas y el SQL de preparación escribían en la base de
desarrollo del usuario (review de T-050, I-2). Fix: el guard corre al cargar la
configuración y dentro de cada consulta directa. Residual: con `DB_PORT` sin definir y
el contenedor publicado en otro puerto, el daño queda limitado a una base `move_e2e*`.
