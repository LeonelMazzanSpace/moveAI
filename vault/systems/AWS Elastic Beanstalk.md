---
type: system
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p9
  - move/MOVE.pdf#p13
  - move/docs/deploy.md
  - move/scripts/package-api-eb.sh
---
# AWS Elastic Beanstalk

Destino de despliegue de la API NestJS, detrás de su balanceador y Nginx. Puede
escalar a varias instancias, con consecuencias para los cron y para la IP de cada
request. Hay runbook y script de empaquetado, pero no se desplegó: falta la cuenta de
AWS y definir instancias y autoscaling.
