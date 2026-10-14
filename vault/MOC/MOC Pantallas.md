---
type: moc
status: shipped
updated: 2026-10-14
source:
  - move/imagenes/htmls
  - move/apps/web/src/app
---
# MOC Pantallas

Una nota por pantalla. Los HTML en `imagenes/htmls/` son la fuente exacta de cada PNG
de `imagenes/finales/`; el código de cada pantalla está en `apps/web/src/app/` y las
capturas actuales en el [[Manual de usuario]]. Sistema visual: [[Sistema visual MOVE]].

## Pública ([[Area publica web]])
- 01 [[Pantalla sitio publico]]
- 02 [[Pantalla acceso]]
- 03 [[Pantalla Performance]]
- 05 [[Pantalla Rehab]]
- 06 [[Pantalla Recovery]]
- sin mockup: [[Pantalla checkout de pago]]
- Contenido de la tanda de comentarios: [[ADR Equipo y Recovery Room como contenido fijo]], [[ADR contacto editable en configuracion]], [[ADR regla Plan vigente en Performance]]

## Cliente ([[Area cliente web]])
- 07 [[Pantalla perfil cliente]]

## Staff ([[Panel staff web]])
- 04 [[Pantalla turnos y asistencia]]
- 08 [[Pantalla clientes staff]]
- 09 [[Pantalla seguimiento]]
- 10 [[Pantalla check-in]]
- sin mockup: [[Pantalla dashboard staff]], [[Pantalla pagos staff]], [[Pantalla configuracion staff]]

## Mobile
[[ADR menu movil en las tres areas]] establece [[Pantallas sin scroll horizontal en mobile]]: menú móvil en las tres áreas y tarjetas en turnos y pagos de staff. La [[Suite E2E Playwright]] lo mide en cada pantalla visitada. Falla resuelta: [[Menu movil se reabre al volver a la pagina]]. Desde la tanda de comentarios, [[ADR auditoria responsive y cambios visuales]] audita todas las rutas a cuatro anchos.

## Tema oscuro
[[ADR radio propio en el tema oscuro]] reemplaza el radio nativo en el checkout y el check-in. Falla resuelta: [[Radio nativo se lee al reves en el tema oscuro]].
