---
type: failure
status: todo
updated: 2026-10-13
source:
  - move/docs/manual/manual-de-usuario.md
  - move/apps/web/package.json
---
# Build de Next falla con NODE_ENV development

Si el shell exporta `NODE_ENV=development` (por ejemplo al tomar las variables de
`.env.example`), `next build` falla en `/_global-error` con "Cannot read properties of
null (reading 'useContext')" (T-037). Fix operativo: build y start de la web con
`NODE_ENV=production`, documentado en el manual. Ningún script lo fuerza todavía.
