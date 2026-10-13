---
type: system
status: shipped
updated: 2026-10-13
source:
  - move/bitbucket-pipelines.yml
  - move/docs/manual/manual-de-usuario.md
---
# Pipeline CI Bitbucket

Gate de CI con lint, tests, e2e de la API contra un Postgres de servicio y build, sin
pasos de deploy hasta tener accesos. Está configurado pero nunca se ejecutó: solo
corre si el repositorio vive en Bitbucket, y D67 publica en GitHub. Queda por decidir
si se espeja en Bitbucket o se pasa el mismo gate a otro CI.

## Structural
- is part of → [[Monorepo MOVE]]
