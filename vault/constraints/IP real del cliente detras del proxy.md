---
type: constraint
status: built-off-by-default
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/app.setup.ts
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/test/trust-proxy.e2e-spec.ts
  - move/docs/deploy.md
---
# IP real del cliente detras del proxy

La API toma la IP del cliente de `X-Forwarded-For` confiando en exactamente
`TRUST_PROXY_HOPS` proxies propios (0 a 5, nunca `true`). El default es 0; detrás del
ALB y el Nginx de Elastic Beanstalk va 2. Más saltos que los reales dejan que el
cliente elija su IP; menos hacen que todos compartan contador.

## Structural
- constrains → [[API NestJS]]
- prevents → [[Throttling por IP ve la IP del proxy]]
