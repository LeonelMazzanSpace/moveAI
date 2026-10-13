---
type: concept
status: todo
semana: 2
updated: YYYY-MM-DD
source:
  - move/MOVE.pdf#p4
---
# Título de la nota

Dos a cuatro oraciones que enuncian la afirmación. Qué es y por qué importa en la
cadena donde está. No se copia ningún párrafo de la fuente: el puntero `source:` de
arriba es cómo el lector llega al detalle.

## Structural
- depends on → [[Otra nota]]
- requires → [[Otra nota]] because el motivo entra en una línea

## Associative
- resembles → [[Una nota de otro dominio]]

<!--
type:    concept | constraint | failure | decision | system | screen | moc   (debe coincidir con la carpeta)
status:  ver "Qué significa status" en 00-START-HERE.md
           shipped              existe en el repo y fue verificado (o, para reglas de proceso, está vigente)
           built-off-by-default existe en el código pero está apagado por configuración
           todo                 en el alcance confirmado por MOVE.pdf, todavía no implementado
           proposed             diseño inferido por el vault, NO está en MOVE.pdf: confirmar antes de tratarlo como regla
           draft                decisión abierta o dato que falta del cliente: bloquea, preguntar a un humano
           superseded           reemplazado; ver la nota que lo `supersedes`
semana:  1–4, semana del MVP en que se entrega (opcional; solo entregables)
updated: fecha exacta YYYY-MM-DD de la última verificación (`date +%F`), nunca "hoy"
source:  una o más rutas relativas al monorepo con prefijo `move/`; `#pN` = página del PDF.
         check.py falla si la ruta no existe.

Ambas secciones de relaciones son opcionales. Una nota sin sección Structural es un
sumidero (fin de cadena). Esperable en failures/, sospechoso en el resto.

Las relaciones salen de _meta/relations.md y de ningún otro lado.
El sujeto es implícito: nunca escribir [[Esta nota]] en sus propias líneas de relación.
Títulos sin tildes ni ñ (robustez de wikilinks entre herramientas).
-->
