---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/common/errors/all-exceptions.filter.ts
  - move/apps/api/test/health.e2e-spec.ts
---
# ADR errores 4xx fuera de contrato como validacion

D35, del review de T-001: un `HttpException` 4xx que no está en la tabla de códigos
se responde 400 `VALIDATION_FAILED` sin log de error; 5xx y errores desconocidos son
500 `INTERNAL_ERROR` con el stack solo en el log. T-034 (D55) extendió la regla a los
errores 4xx de body-parser, como el 413 de un body de más de 1 MB.

## Structural
- establishes → [[Errores internos no expuestos]]
- constrains → [[API NestJS]]
