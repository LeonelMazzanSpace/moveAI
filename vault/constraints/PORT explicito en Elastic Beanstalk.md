---
type: constraint
status: proposed
semana: 4
updated: 2026-10-13
source:
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
  - move/apps/api/src/config/app.config.ts
---
# PORT explicito en Elastic Beanstalk

En la plataforma Node.js de Elastic Beanstalk sobre AL2023, Nginx reenvía al puerto
5000 salvo que la propiedad de entorno `PORT` diga otro. La API escucha en `PORT`
(3001 por defecto), así que el entorno tiene que fijarlo explícitamente (por ejemplo
8080). El runbook y la sección AWS del manual ya lo indican; no se aplicó porque no
hubo deploy.

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- prevents → [[API inalcanzable detras del proxy de Elastic Beanstalk]]
