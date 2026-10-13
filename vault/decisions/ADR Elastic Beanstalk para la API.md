---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
  - move/docs/deploy.md
---
# ADR Elastic Beanstalk para la API

La API NestJS se despliega en AWS Elastic Beanstalk, con variables sensibles en la
configuración del entorno. Escalar a varias instancias habilita cron duplicados, y
cada instancia nueva cambia la IP de salida y llega detrás de un proxy con puerto
propio. Hay runbook, pero no se desplegó (D51).

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- establishes → [[Sin secretos en codigo]]
- establishes → [[PORT explicito en Elastic Beanstalk]]
- enables → [[Job ejecutado en varias instancias]]
- enables → [[Throttling por IP ve la IP del proxy]]
- enables → [[Emails bloqueados por IP nueva en Brevo]]
