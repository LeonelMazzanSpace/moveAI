---
type: constraint
status: shipped
semana: 4
updated: 2026-10-13
source:
  - move/apps/api/src/modules/settings/settings.defaults.ts
  - move/apps/api/src/modules/followup/domain/alert-rules.ts
---
# Reglas de automatizacion en Postgres

Los umbrales y fechas que evalúan los jobs (días por vencer, días sin asistir,
inactividad prolongada, baja de frecuencia, re-contactos) se guardan en PostgreSQL y
los edita el staff. La forma de cada regla sí vive en código, como funciones puras del
módulo de seguimiento.

## Structural
- constrains → [[Modulo automatizaciones]]
