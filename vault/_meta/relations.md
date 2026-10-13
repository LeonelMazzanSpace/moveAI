# Vocabulario de relaciones

Esta lista es cerrada. Es la barrera que mantiene el grafo tipado: un vocabulario
abierto es la forma en que un grafo dirigido degenera en "relacionado con".

Agregar una relación es una edición deliberada de este archivo, nunca algo que se
hace al pasar mientras se escribe una nota. Si una arista no se puede nombrar con
esta lista, probablemente es débil: eso es motivo para descartarla, no para inventar
un nombre.

Los nombres de relación quedan en inglés porque `_meta/check.py` los lee
literalmente de las tablas de abajo. El resto del vault está en español.

## Formato de línea

    - <relación> → [[Destino]]
    - <relación> → [[Destino]] because <motivo>

El sujeto es la nota misma y nunca se repite como wikilink. Cada arista se escribe
una sola vez, en la nota donde se origina. Las aristas entrantes se leen en el panel
de backlinks de Obsidian, o en `_meta/edges.md` cuando se lee el vault como archivos.

## Direcciones convencionales en este vault

Para que la capa estructural siga siendo acíclica, las aristas fluyen siempre en
este sentido:

    decisión ──establishes──▶ restricción ──prevents/mitigates──▶ falla
    decisión ──constrains───▶ sistema
    decisión ──enables──────▶ falla       (riesgo que la decisión abre a sabiendas)
    restricción ──constrains──▶ concepto | sistema
    restricción ──requires / enables──▶ restricción | concepto
    pantalla ──is part of / depends on──▶ sistema
    concepto ──is part of──▶ sistema (módulo dueño)
    sistema ──depends on / is part of──▶ sistema
    concepto (mecanismo) ──causes / enables──▶ falla
    concepto (defensa) ──constrains / mitigates──▶ sistema | falla
    falla ──causes──▶ falla

Un sistema nunca apunta a una restricción ni a una decisión: las restricciones que
lo gobiernan se leen como aristas entrantes en `_meta/edges.md`.

## Structural

Dirigida y acíclica. Es la capa que se recorre para explicar, diagnosticar o
planificar la construcción.

| Relation | Usar cuando |
| --- | --- |
| `requires` | El destino debe cumplirse para que el sujeto sea seguro o posible. |
| `depends on` | El sujeto no funciona sin el destino. Entre sistemas: construir el destino primero. |
| `causes` | El sujeto produce el destino. Mecanismo → resultado. |
| `enables` | El sujeto hace posible el destino sin forzarlo. |
| `forbids` | El sujeto descarta el destino. Restricción vs anti-patrón. |
| `mitigates` | El sujeto reduce la probabilidad o el impacto del destino. |
| `prevents` | El sujeto elimina el destino por completo. Más fuerte que `mitigates`. |
| `evidences` | El sujeto es un dato observado que respalda el destino. |
| `constrains` | El sujeto limita cómo se diseña u opera el destino. |
| `establishes` | Una decisión crea la restricción destino. Solo en notas de decisión. |
| `supersedes` | El sujeto reemplaza al destino. Típico entre ADRs. |
| `is part of` | Composición. |
| `is a case of` | Instancia específica del patrón general del destino. |

## Associative

Puede tener ciclos. Para descubrir y explicar por analogía, nunca para diagnosticar.
Mantenerla escasa: una arista asociativa igual tiene que responder "¿por qué estas
dos ideas deberían hablarse?".

| Relation | Usar cuando |
| --- | --- |
| `resembles` | Misma forma en otro dominio. |
| `contrasts with` | Diferencia instructiva, incluida una alternativa descartada. |
| `is a metaphor for` | Útil para explicar el destino a alguien nuevo. |
| `opens a question about` | El sujeto plantea una pregunta abierta sobre el destino. |
