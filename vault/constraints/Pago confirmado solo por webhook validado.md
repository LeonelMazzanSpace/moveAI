---
type: constraint
status: todo
semana: 2
updated: 2026-10-13
source:
  - move/MOVE.pdf#p11
  - move/MOVE.pdf#p12
---
# Pago confirmado solo por webhook validado

El PDF pide que el backend reciba y valide las confirmaciones de Mercado Pago. El
mecanismo es propuesta del vault: el estado se toma solo de una notificación con firma
`x-signature` válida y re-consultada en la API de Mercado Pago, nunca de la
redirección del navegador.

## Structural
- constrains → [[Modulo pagos]]
- prevents → [[Webhook falsificado]]
- prevents → [[Plan activado sin pago confirmado]]
