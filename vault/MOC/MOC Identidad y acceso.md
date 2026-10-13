---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p3
  - move/MOVE.pdf#p10
---
# MOC Identidad y acceso

Espina 4. Quién es cada persona, cómo entra y qué puede hacer.

## Cadena
- [[Perfil Visitante]] → (flujo de reserva o registro) → [[Usuario]] → [[Perfil Cliente]] o [[Perfil Staff]]
- [[Better Auth]] + [[Google OAuth]] → [[Modulo auth]] → [[Modulo usuarios]]

## Decisiones
- [[ADR tres perfiles de usuario]]
- [[ADR Better Auth con Google OAuth]]
- [[ADR ubicacion de Better Auth]] (abierta, bloquea la semana 1)

## Reglas
- [[Roles persistidos cliente y staff]] y [[Autorizacion validada en la API]]
- [[Cuenta se crea durante la reserva]] y [[Una cuenta por email]]
- [[Web y API bajo el mismo dominio raiz]]

## Fallas
[[Cliente accede a funciones de staff]] · [[Cuentas duplicadas por email]] ·
[[Historial del cliente fragmentado]] · [[Sesion no viaja entre web y API]]
