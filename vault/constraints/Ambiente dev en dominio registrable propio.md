---
type: constraint
status: proposed
semana: 4
updated: 2026-10-13
source:
  - move/docs/deploy.md
  - move/docs/manual/manual-de-usuario.md
  - move/apps/api/src/app.setup.ts
---
# Ambiente dev en dominio registrable propio

Una preview de Vercel con URL automática no puede usar la API de dev: CORS y Better
Auth aceptan solo `WEB_URL` y la cookie no llega a `*.vercel.app`. Dev usa un dominio
fijo que tiene que ser otro dominio registrable (`<dominio-dev>` y
`api.<dominio-dev>`, con `COOKIE_DOMAIN=.<dominio-dev>`), nunca un subdominio de
producción: ahí la cookie de producción, también la del staff, llegaría al código de
dev y `SameSite=Lax` no frenaría un formulario de dev contra la API de producción.
Elegir un subdominio igual es una decisión abierta con riesgo aceptado y perfiles de
navegador separados obligatorios. Nada está desplegado.

## Structural
- constrains → [[Vercel]]
- requires → [[Web y API bajo el mismo dominio raiz]]
- mitigates → [[Sesion no viaja entre web y API]]
