---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/calendar/services/calendar-connection.service.ts
  - move/apps/api/test/calendar.e2e-spec.ts
---
# Calendario perdido se olvida al reconectar

Cuando Google responde 404, 410 o 403 sobre el calendario elegido, la conexión pasa a
`needs_reconnect`, libera los turnos bloqueados y además olvida ese calendario (y sus
links de eventos), así "Reconectar" lleva a elegir uno nuevo. Solo marca la pérdida si
la conexión sigue apuntando al calendario que falló, y el aviso al staff lleva el tipo
de error en su clave (D113, D115).

## Structural
- constrains → [[Google Calendar]]
- prevents → [[Reconexion vuelve al calendario perdido]]
