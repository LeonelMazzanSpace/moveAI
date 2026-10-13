---
type: failure
status: built-off-by-default
updated: 2026-10-13
source:
  - move/apps/api/src/app.setup.ts
  - move/apps/api/test/trust-proxy.e2e-spec.ts
  - move/docs/deploy.md
---
# Throttling por IP ve la IP del proxy

Detrás del ALB y el Nginx de Elastic Beanstalk todas las requests llegan desde
127.0.0.1; sin `trust proxy`, el límite de checkout por IP es uno solo para todos y
bloquea a todos los clientes a la vez (review de T-031, R-1). Fix en T-036:
`TRUST_PROXY_HOPS`. La defensa está en el código pero hay que configurarla al
desplegar (2 en Beanstalk).
