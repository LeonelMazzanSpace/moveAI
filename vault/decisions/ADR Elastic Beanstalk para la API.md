---
type: decision
status: todo
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p13
---
# ADR Elastic Beanstalk para la API

La API NestJS se despliega en AWS Elastic Beanstalk, con variables sensibles en la
configuración del entorno. Su capacidad de escalar a varias instancias habilita la
ejecución duplicada de los cron.

## Structural
- constrains → [[AWS Elastic Beanstalk]]
- establishes → [[Sin secretos en codigo]]
- enables → [[Job ejecutado en varias instancias]]
