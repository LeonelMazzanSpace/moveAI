---
type: failure
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p13
  - move/.gitignore
---
# Secretos filtrados

Credenciales de Mercado Pago, Brevo, Google o la base terminan en el repo, en el
bundle del front o en logs. Defensa activa: secretos solo por entorno, `.env`
ignorados y CI con un único secreto en variables del repositorio.
