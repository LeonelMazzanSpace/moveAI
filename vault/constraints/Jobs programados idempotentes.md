---
type: constraint
status: proposed
semana: 4
updated: 2026-10-13
source:
  - move/MOVE.pdf#p12
---
# Jobs programados idempotentes

Correr un job dos veces el mismo día no crea alertas ni emails repetidos. Cada
alerta tiene una clave única (cliente, tipo, período) y cada envío deja registro
antes de mandarse.

## Structural
- constrains → [[Modulo automatizaciones]]
- prevents → [[Alertas o emails duplicados]]
