---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/config/env.validation.ts
  - move/apps/api/src/common/errors/error-codes.ts
---
# ADR un parser por variable de entorno

D64, del review de T-036: `TRUST_PROXY_HOPS` se valida y convierte una sola vez con el
mismo criterio (solo un dígito de 0 a 5), para que Express nunca reciba otro valor que
el validado. El mismo fix cambió el mensaje de `RATE_LIMITED`, porque la ventana
horaria bloquea hasta una hora.

## Structural
- establishes → [[Variable de entorno parseada una sola vez]]
- constrains → [[API NestJS]]
