---
type: system
status: todo
semana: 1
updated: 2026-10-13
source:
  - move/MOVE.pdf#p10
  - move/MOVE.pdf#p16
---
# Modulo auth

Módulo que integra Better Auth en la plataforma: registro, login, recuperación,
Google y guards de rol para proteger endpoints. Dónde corre Better Auth (web o API)
está sin decidir.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Better Auth]]
- depends on → [[Google OAuth]]
- depends on → [[Modulo usuarios]]
