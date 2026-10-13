---
type: constraint
status: proposed
semana: 4
updated: 2026-10-13
source:
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
---
# Rama dev de Neon sin expiracion

La consola de Neon marca por defecto el borrado automático de un branch nuevo al día.
El branch `development` se crea sin esa opción y con rol y base propios: un branch
hereda roles y contraseñas del padre, salvo que el padre sea un protected branch, y
las credenciales de dev nunca deben servir para producción. Documentado en el runbook
y el manual; no se aplicó.

## Structural
- constrains → [[Neon Postgres]]
- prevents → [[Base de dev borrada por expiracion de rama Neon]]
