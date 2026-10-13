---
type: failure
status: todo
updated: 2026-10-13
source:
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
---
# API inalcanzable detras del proxy de Elastic Beanstalk

Nginx de Elastic Beanstalk reenvía al 5000 mientras la API escucha en otro puerto, y
todas las requests fallan aunque la instancia esté sana. El runbook anterior daba 8080
como default del proxy, lo que llevaba justo a este error; T-038 lo corrigió. No hay
defensa en código: depende de fijar `PORT` al desplegar.
