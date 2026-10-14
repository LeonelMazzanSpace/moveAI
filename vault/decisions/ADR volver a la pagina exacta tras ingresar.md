---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/web/src/proxy.ts
  - move/apps/web/src/lib/auth/session.ts
  - move/apps/web/src/lib/auth/safe-next.ts
  - move/apps/web/src/lib/auth/post-login.ts
---
# ADR volver a la pagina exacta tras ingresar

D39, diferida en T-006 y aplicada en T-033: `proxy.ts` reenvía la ruta actual en un
header y las guardas la usan como `next`, validada como ruta interna permitida para el
rol. Sin sesión, el checkout de un plan o el link de check-in del email vuelven a esa
misma página después de ingresar. Desde T-043 el `next` se normaliza con
`safeNextPath` (segmentos `..`, barras dobles y caracteres de control) antes de
excluir las rutas de acceso.

## Structural
- constrains → [[App web Next]]
