# Auditoría responsive (D98, T-065)

Auditoría de todas las rutas de la web a 375×812, 768×1024, 1024×768 y 1440×900 con `pnpm responsive:audit`
(`scripts/responsive/audit.mjs`). Estado actual: **219 combinaciones revisadas (rutas × anchos, más el menú móvil abierto donde existe), 0 hallazgos, código de salida 0.**

## Cómo se corre

Con la API y la web levantadas y una base con los datos de `pnpm manual:demo-data`:

```bash
export MANUAL_STAFF_PASSWORD=… MANUAL_CLIENT_PASSWORD=…   # las de la demo
export API_URL=http://localhost:<puerto API>/api WEB_URL=http://localhost:<puerto web>
pnpm responsive:audit            # AUDIT_ONLY=/staff/turnos para repetir solo una ruta
```

Ingresa como cliente (Sofía Martínez) y como staff, recorre las rutas del route map más las seis pestañas de Configuración
(`planes`, `horarios`, `profesionales`, `reglas`, `contacto`, `calendario`) y, por cada combinación, revisa:

- **scroll** — scroll horizontal de la página (`scrollWidth > clientWidth`);
- **fuera** — elementos visibles fuera del viewport, o cortados por un contenedor `overflow: hidden` (los que tienen su propio scroll horizontal están bien);
- **tap** — botones, links (no en línea dentro de un texto), selects y campos con área menor a 32×32 px (un checkbox o radio se mide por su etiqueta; un link "estirado" sobre toda la fila se mide completo);
- **txt** — texto cortado por `overflow` (recorte o puntos suspensivos).

Guarda una captura de página completa por combinación en `tmp/responsive/` (ignorado por git) y `resultado.json`. Donde el botón "Abrir menú" está visible también abre el menú y revisa el panel.

No cubre: diálogos y formularios que se abren con un clic (alta de plan, pago manual, etc.), estados de error de la API ni datos vacíos.

## Primera corrida

190 combinaciones, **2648 hallazgos**: tap (área táctil < 32 px): 2543 · scroll horizontal de la página: 16 · elementos fuera del viewport: 14 · txt (texto cortado): 75.

Los 75 `txt*` eran falsos positivos del script (texto `sr-only`, que mide 1×1 px con recorte a propósito): se corrigió el script, no la web. La tabla muestra la primera corrida por celda (`OK` = sin hallazgos); **en la corrida final todas las celdas dan OK**.

| Ruta (rol) | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| `/` (anon) | tap ×22 | scroll ×1, fuera ×1, tap ×19 | tap ×19 | tap ×19 |
| `/performance` (anon) | tap ×32 | scroll ×1, fuera ×1, tap ×24 | tap ×24 | tap ×24 |
| `/rehab` (anon) | tap ×14 | scroll ×1, fuera ×1, tap ×15 | tap ×15 | tap ×15 |
| `/recovery` (anon) | tap ×16 | scroll ×1, fuera ×1, tap ×16 | tap ×16 | tap ×16 |
| `/planes` (anon) | tap ×22 | scroll ×1, fuera ×1, tap ×19 | tap ×19 | tap ×19 |
| `/planes?service=performance` (anon) | tap ×16 | scroll ×1, fuera ×1, tap ×16 | tap ×16 | tap ×16 |
| `/planes?service=recovery` (anon) | tap ×16 | scroll ×1, fuera ×1, tap ×16 | tap ×16 | tap ×16 |
| `/reservar` (anon) | tap ×10 | scroll ×1, fuera ×1, tap ×13 | tap ×13 | tap ×13 |
| `/checkout/resultado?ref=<ref>` (anon) | tap ×10 | scroll ×1, fuera ×1, tap ×13 | tap ×13 | tap ×13 |
| `/checkout/resultado?debito=<ref>` (anon) | tap ×10 | scroll ×1, fuera ×1, tap ×13 | tap ×13 | tap ×13 |
| `/checkout/simulado?ref=<ref>` (anon) | tap ×10 | scroll ×1, fuera ×1, tap ×13 | tap ×13 | tap ×13 |
| `/checkout/simulado?debito=<ref>` (anon) | tap ×10 | scroll ×1, fuera ×1, tap ×13 | tap ×13 | tap ×13 |
| `/ingresar` (anon) | tap ×3 | tap ×3 | tap ×3 | tap ×3 |
| `/registro` (anon) | tap ×2 | tap ×2 | tap ×2 | tap ×2 |
| `/recuperar` (anon) | tap ×2 | tap ×2 | tap ×2 | tap ×2 |
| `/restablecer?token=audit` (anon) | tap ×2 | tap ×2 | tap ×2 | tap ×2 |
| `/continuar` (anon) | tap ×2 | tap ×2 | tap ×2 | tap ×2 |
| `/` (client) | tap ×22 | scroll ×1, fuera ×1, tap ×19 | tap ×19 | tap ×19 |
| `/perfil` (client) | tap ×17 | tap ×14 | tap ×14 | tap ×14 |
| `/historial` (client) | tap ×9 | tap ×9 | tap ×9 | tap ×9 |
| `/reservar/fisioterapia` (client) | tap ×3 | tap ×6 | tap ×6 | tap ×6 |
| `/checkout/plan/performance-mensual` (client) | tap ×7, txt* ×2 | tap ×8, txt* ×1 | tap ×8, txt* ×1 | tap ×8, txt* ×1 |
| `/check-in` (client) | tap ×3 | tap ×6 | tap ×6 | tap ×6 |
| `/` (staff) | tap ×22 | scroll ×1, fuera ×1, tap ×19 | tap ×19 | tap ×19 |
| `/staff` (staff) | tap ×3 | tap ×2 | tap ×2 | tap ×2 |
| `/staff/clientes` (staff) | tap ×41 | tap ×21 | tap ×21 | tap ×21 |
| `/staff/clientes/nuevo` (staff) | tap ×1 | tap ×1 | tap ×1 | tap ×1 |
| `/staff/clientes/<id>` (staff) | tap ×3 | tap ×2 | tap ×2 | tap ×2 |
| `/staff/turnos` (staff) | tap ×17, txt* ×4 | scroll ×1, tap ×9, txt* ×2 | tap ×9, txt* ×2 | tap ×9, txt* ×2 |
| `/staff/pagos` (staff) | tap ×9, txt* ×24 | tap ×5, txt* ×12 | tap ×5, txt* ×12 | tap ×5, txt* ×12 |
| `/staff/seguimiento` (staff) | tap ×65 | tap ×33 | tap ×33 | tap ×33 |
| `/staff/seguimiento?tipo=checkin` (staff) | tap ×65 | tap ×33 | tap ×33 | tap ×33 |
| `/staff/seguimiento/check-in` (staff) | tap ×13 | tap ×7 | scroll ×1, tap ×7 | tap ×7 |
| `/staff/configuracion?tab=planes` (staff) | tap ×57 | tap ×29 | tap ×29 | tap ×29 |
| `/staff/configuracion?tab=horarios` (staff) | tap ×219 | tap ×110 | tap ×110 | tap ×110 |
| `/staff/configuracion?tab=profesionales` (staff) | tap ×17 | tap ×9 | tap ×9 | tap ×9 |
| `/staff/configuracion?tab=reglas` (staff) | tap ×19 | tap ×10 | tap ×10 | tap ×10 |
| `/staff/configuracion?tab=contacto` (staff) | tap ×15 | tap ×8 | tap ×8 | tap ×8 |
| `/staff/configuracion?tab=calendario` (staff) | tap ×13 | tap ×7 | tap ×7 | tap ×7 |

Menú móvil abierto: se revisa en cada ancho donde el botón "Abrir menú" está visible; en la corrida final, 63 paneles, todos OK.

## Hallazgos y cómo se resolvieron

| # | Hallazgo (primera corrida) | Fix |
|---|---|---|
| 1 | **Botones y links de 17–29 px de alto** en todo el sitio (2543 hallazgos): todos los botones MOVE (`moveButton`) medían 28–29 px; links de navegación, de footer, "Volver al sitio", "Ver todo", etc. de 16–20 px. | `moveButtonSize` suma `min-h-8` (32 px; en `components/move/button-styles.ts`, test nuevo). Links de texto sueltos: `inline-flex min-h-8 items-center` (nav de las cabeceras, logo, footer, login "¿Olvidaste tu contraseña?", "Ver todas/Ver todo", aviso del dashboard, "Volver al sitio"). `Button` `sm` pasa de `h-7` a `h-8` e `icon-sm` de `size-7` a `size-8` (acciones del turno, anterior/siguiente semana, "Cancelar reserva", "Cancelar débito"). Pestañas Todo/Reservas/Pagos del perfil: lista de 40 px. |
| 2 | **Cabecera pública desborda a 768 px** (scroll horizontal de 66 px en 12 rutas públicas + inicio de cliente y staff): seis links y dos botones no entran desde que se sumó "Equipo". | La navegación en línea de la cabecera pública y sus botones pasan de `md` a `lg`; entre 768 y 1023 px se usa el menú móvil (`HeaderNav`/`MobileNav` aceptan `breakpoint`, `nav-items.ts`). Las cabeceras de cliente y staff siguen como estaban. |
| 3 | **Panel de staff a 768 px**: la sidebar de 240 px dejaba 464 px de contenido (tarjetas KPI de `/staff/turnos` desbordaban 2 px y la tabla de turnos mostraba solo 3 columnas, con las acciones a la derecha fuera de vista). | `staff/layout.tsx` `p-8` → `p-4 md:p-8`; sidebar y barra superior pasan a `lg` (menú móvil por debajo); las tablas de turnos y pagos se muestran como tarjetas por debajo de `xl` (antes `md`; con la sidebar a 1024 px el contenido mide 720 px y la tabla necesita 882); los KPI de turnos y clientes pasan de `sm:grid-cols-4` a `sm:grid-cols-2 xl:grid-cols-4`. |
| 4 | **Check-in del staff a 1024 px**: scroll horizontal de 8 px (`lg:grid-cols-[400px_1fr]` con la sidebar). | `xl:grid-cols-[400px_minmax(0,1fr)]`. Mismo cuidado (`minmax(0,1fr)`) en `rehab-booking-flow.tsx`, que también usa una columna fija a partir de `lg`. |
| 5 | **Pestañas de Configuración** (ahora 6) en varias filas. | Una sola fila con `overflow-x-auto` propio y pestañas `shrink-0`. |
| 6 | Etiquetas de checkbox/radio de 20 px de alto (radio de forma de pago del checkout, reglas, formulario de planes) y switch de seguimiento fisioterapéutico de 36×20 px; selector de día de `/performance` de 17 px. | `min-h-8` en las etiquetas; el switch queda dentro de un botón de 44×32 px con la pista visual igual; el select del día `min-h-8`. |

Cambios de comportamiento: ninguno de lógica ni de copy. Cambios visibles: botones MOVE de 28–29 px a 32 px de alto; tablets (768–1023 px) usan el menú móvil en el sitio público y en el panel de staff, y las tablas de turnos y pagos son tarjetas hasta 1279 px.

## Pendiente de revisión visual (no son hallazgos del script)

- Pestañas de Configuración a 375 px: la pestaña activa puede quedar fuera de la vista dentro de su fila con scroll (por ejemplo "Contacto" o "Calendario"); el script solo comprueba que la página no haga scroll.
- Los diálogos (alta de plan, pago manual, calendario) no se recorren; los fixes de etiquetas de `plan-form.tsx` se aplicaron por analogía con las pestañas auditadas.
