# Empezar acá

Este vault guarda el conocimiento transversal de MOVE como un **grafo tipado y
dirigido**. Es una capa de razonamiento, no una segunda copia de la documentación:
`MOVE.pdf`, los mockups en `imagenes/` y el código en `apps/` siguen siendo la fuente,
y cada nota apunta al archivo de donde salió.

Empezar en [[MOC MOVE]]. Para construir, ir a [[MOC Roadmap MVP]].

## Cómo leer una nota

Cada nota enuncia una sola afirmación en pocas oraciones y después lista sus aristas
en dos capas:

- `## Structural`: la capa que se recorre para diagnosticar y para planificar.
- `## Associative`: la capa para explicar o explorar.

Hay tres convenciones que conviene saber antes de agregar algo:

1. **Las relaciones salen de `_meta/relations.md` y de ningún otro lado.** También
   fija la dirección de las aristas (decisión → restricción → falla, pantalla →
   módulo, etc.).
2. **Cada arista se escribe una sola vez, en la nota donde se origina.** Las
   entrantes se ven en el panel de backlinks o, como archivos, en `_meta/edges.md`.
3. **El `status` del frontmatter es vinculante** (ver la tabla de abajo).

Correr `python3 _meta/check.py` después de editar.

## Qué significa `status`

| status | En una nota de sistema, pantalla o restricción | En una falla |
| --- | --- | --- |
| `shipped` | Existe en el repo y se verificó en la fecha de `updated` (para reglas de proceso: vigente) | Ya hay una defensa activa en el código |
| `built-off-by-default` | Existe en el código pero está apagada por configuración | La defensa existe pero hay que activarla por configuración al desplegar |
| `todo` | Confirmada por `MOVE.pdf`, por un estándar SpaceDev (el texto lo dice) o por una decisión del equipo; todavía no implementada | No hay defensa implementada |
| `proposed` | Diseño inferido por el vault que **no está en el PDF**: confirmarlo con el equipo | — |
| `draft` | Decisión abierta o dato del cliente que falta: **bloquea**, preguntar | — |
| `superseded` | Reemplazada; ver la nota que la `supersedes` | — |

En una **decisión** (ADR): `shipped` = aplicada en el repo, o vigente si es de proceso;
`todo` = acordada pero todavía sin reflejo en el código; `superseded` = reemplazada por
otro ADR. Una restricción puede estar `shipped` aunque su ADR esté en `todo` solo si es
una regla de proceso ya vigente.

`semana: N` marca en qué semana del MVP **empieza** a construirse algo; puede
completarse en semanas posteriores (por ejemplo, el modelo de agenda en la 1 y los cupos
en la 2).

## Protocolo del orquestador

1. **Elegir la nota de trabajo** en [[MOC Roadmap MVP]], respetando la semana y el
   orden: un `system` o `screen` en `todo`. Si el roadmap nombra una nota `draft` o
   `proposed`, primero se resuelve con un humano (paso 5).
2. **Dependencias primero.** Desde la nota, seguir recursivamente `depends on` e
   `is part of` hacia abajo. Todo lo alcanzable en `todo` se construye antes o en la
   misma tarea. Los destinos de deploy (Vercel, Elastic Beanstalk, Neon) no son
   dependencias de construcción: se configuran en la tarea de ambientes de la semana 1.
3. **Juntar reglas.** El *alcance* de la tarea es la nota de trabajo más cada sistema
   alcanzado en el paso 2 que esté en `todo`. Para cada nota del alcance, buscar en
   `_meta/edges.md` todos los conceptos que llegan a ella por una cadena de
   `is part of` o `is a case of` de **cualquier largo** (por ejemplo, Pago → Compra →
   Modulo pagos). Para cada nota del alcance y cada uno de esos conceptos, juntar las
   aristas entrantes `constrains` y `requires`. Sumar siempre las reglas transversales
   de [[MOC Plataforma y entrega]]. Esas restricciones son los requisitos.
4. **Juntar fallas.** De cada restricción y de cada concepto juntado, seguir `prevents`,
   `mitigates`, `causes` y `enables` hasta llegar a notas de `failures/`, y desde ahí
   seguir `causes` hacia adelante para ver las consecuencias. Cada falla alcanzada
   desde una defensa es un test (unitario o e2e) que demuestra esa defensa.
5. **Respetar el status.** Un `draft` en el camino frena **la parte que depende de
   él**: preguntar, o avanzar con valores provisorios explícitos si la nota lo permite.
   Un `proposed` se implementa solo si el humano lo confirma; si no, se declara como
   supuesto en el PR.
6. **Contexto del stack.** Antes de backend, cargar el skill `/backend` y seguir
   [[ADR modulos simples por dominio]] (no hexagonal). Antes de frontend, cargar
   `/frontend`, con [[ADR Next App Router en lugar de Vite]] como excepción. Las
   pantallas se construyen leyendo el HTML del mockup que indica `source:`.
7. **Cerrar el ciclo.** Al terminar:
   - pasar a `shipped` lo construido y las fallas que quedaron defendidas;
   - actualizar `updated:` y apuntar `source:` a las rutas reales del código;
   - correr `check.py`.

   Un cambio que contradice una nota actualiza la nota o crea un ADR que la `supersedes`.

## Probalo

Hacé estas preguntas con el vault como único contexto. Cada una tiene que volver como
una cadena causal que termina en acciones ordenadas, no como una lista de temas.

1. *Un alumno con el plan Trimestral vencido intenta reservar Performance a las 19:00,
   donde quedan 13/14 lugares, al mismo tiempo que otro alumno con plan vigente. ¿Qué
   debe pasar con cada uno, qué piezas lo garantizan y en qué orden se construyen?*
2. *Un cliente dice: "pagué en Mercado Pago y mi plan sigue inactivo". Recorré hacia
   atrás desde la falla y decí qué revisar y qué defensas faltan.*
3. *La API se despliega en Elastic Beanstalk con dos instancias. ¿Qué obliga eso sobre
   las automatizaciones de seguimiento y qué fallas aparecen si se ignora?*

Una respuesta vaga dice algo del grafo, no del modelo: la espina está poco tipada, y
se arregla con mejores aristas, no con más notas.

## Qué hay acá

Cuatro espinas modeladas en profundidad: [[MOC Circuito Performance]],
[[MOC Pagos y activacion]], [[MOC Seguimiento y retencion]] y
[[MOC Identidad y acceso]]. Además están [[MOC Rehab y Recovery]],
[[MOC Plataforma y entrega]] y [[MOC Pantallas]]. Lo que deliberadamente no se
modeló está al final de [[MOC MOVE]].
