# MOVE vault

Grafo de conocimiento tipado y dirigido de la plataforma MOVE (Performance, Rehab &
Recovery). Es la **fuente de verdad del orquestador** que construye el monorepo: qué
se construye, en qué orden, bajo qué reglas y contra qué fallas. Leer
`00-START-HERE.md` antes de trabajar acá (mecánica del vault y protocolo del
orquestador), y `architecture-overview.md` para orientarse en el dominio.

Las fuentes primarias siguen siendo `MOVE.pdf`, `imagenes/htmls/*.html` (mockups) y
el código en `apps/`. Cada nota apunta a ellas en `source:`; el vault conecta, no
copia.

Convenciones fáciles de romper:

- **Las relaciones salen de la lista cerrada en `_meta/relations.md`.** Nunca se
  inventa una en el momento. Si ninguna encaja, la arista es débil: se descarta.
- **Cada arista se escribe una sola vez, en la nota donde se origina.** El sujeto es
  implícito: nunca un wikilink a sí mismo en sus propias líneas. Las aristas entrantes están
  en `_meta/edges.md`, un índice inverso generado: leerlo en lugar de hacer grep, y
  nunca editarlo.
- **El `status` del frontmatter es vinculante.** `todo` significa que no existe en el
  código. `proposed` es diseño inferido por el vault, no pedido por MOVE: confirmarlo
  antes de tratarlo como regla. `draft` bloquea y hay que preguntar a un humano. Nunca
  citar una nota `todo` o `proposed` como si fuera una defensa que ya existe.
- **Las notas nuevas siguen `_meta/note-template.md`**, en la carpeta que corresponde
  a su `type`, con `source:` del tipo `move/<ruta>` (`#pN` = página del PDF). Títulos
  sin tildes ni ñ. Nunca se copia prosa de las fuentes.
- **Al cambiar código, se actualiza el vault en el mismo cambio**: `status`,
  `updated: YYYY-MM-DD` (de `date +%F`) y `source:` apuntando al archivo real.

Después de cualquier edición, correr el validador. Necesita Python 3.9 o superior; si
el `python3` del shell no tiene versión configurada, usar `/opt/homebrew/bin/python3`:

    python3 _meta/check.py

Valida vocabulario, frontmatter, que existan las rutas `source:` y que resuelvan los
wikilinks. Falla ante ciclos estructurales y regenera `_meta/edges.md`. Tiene que
terminar limpio.
