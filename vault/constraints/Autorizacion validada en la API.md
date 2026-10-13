---
type: constraint
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/MOVE.pdf#p18
---
# Autorizacion validada en la API

Cada endpoint declara qué rol lo usa y la API lo verifica con guards. Las
operaciones de cliente además verifican que el recurso sea del usuario. Ocultar
rutas en el front no protege nada.

## Structural
- constrains → [[Modulo auth]]
- prevents → [[Cliente accede a funciones de staff]]
