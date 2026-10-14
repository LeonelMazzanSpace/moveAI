---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/common/validation/well-formed.ts
  - move/apps/api/test/settings-contact.e2e-spec.ts
  - move/apps/api/test/clients.e2e-spec.ts
  - move/apps/api/test/checkout.e2e-spec.ts
---
# Surrogate suelto responde 500

Un texto con un surrogate UTF-16 sin par pasaba la validación y la API respondía 500
en lugar de 400. En contacto, Postgres rechaza el escape `\ud800` al guardar en `jsonb`
(review T-058, I-1); en los emails del alta de clientes y del checkout público,
`isEmail` lanza `URIError` (T-069). Los e2e prueban cada campo con surrogates altos y
bajos sueltos, y que un emoji sí pasa.
