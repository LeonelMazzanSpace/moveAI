---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/scripts/responsive/audit.mjs
  - move/docs/responsive-audit.md
  - move/scripts/manual/capture.mjs
  - move/scripts/manual/demo-data.mjs
---
# Scripts nunca contra los puertos 3000 y 3001

Los puertos 3000 (web) y 3001 (API) son los de la app que el usuario corre en local.
Los scripts que inician sesión y recorren pantallas o cargan datos no tienen URL por
defecto: exigen `WEB_URL` y `API_URL`, rechazan esos dos puertos y cualquier host que
no sea local. Así funcionan `pnpm responsive:audit` (T-065) y `scripts/manual/capture.mjs`,
sin excepción. `scripts/manual/demo-data.mjs` admite una sola excepción explícita,
`MANUAL_ALLOW_DEV_PORTS=1`, para quien quiere poblar su propia app de desarrollo. Los
workers nunca la usan y el manual la muestra aparte, con advertencia (D124).

### Structural
- constrains → [[Monorepo MOVE]]
- constrains → [[Manual de usuario]]
- prevents → [[Auditoria responsive contra la app del usuario]]

### Associative
- resembles → [[Suite E2E solo sobre su base propia]]
