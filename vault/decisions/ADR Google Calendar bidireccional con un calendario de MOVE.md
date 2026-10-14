---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/calendar/calendar.module.ts
  - move/apps/api/src/modules/calendar/services/calendar-sync.service.ts
  - move/apps/api/src/modules/calendar/services/calendar-connection.service.ts
---
# ADR Google Calendar bidireccional con un calendario de MOVE

D94, D95, D113 y D115: las reservas de Rehab y un único calendario de Google de MOVE,
conectado por el staff desde Configuración → "Calendario" con un OAuth propio (aparte
del login), se sincronizan en ambos sentidos. Las reservas confirmadas se publican
como eventos con solo el nombre del cliente; un ocupado en Google bloquea el turno,
pero nunca cancela una reserva existente: avisa al staff una vez por reserva. Un
calendario borrado o sin permiso cuenta como conexión perdida. Al desconectar, los
eventos creados quedan en Google.

## Structural
- constrains → [[Google Calendar]]
- establishes → [[Turno bloqueado por Google no reservable]]
- establishes → [[Conexion de calendario re-verificada antes de escribir]]
- establishes → [[Calendario perdido se olvida al reconectar]]

## Associative
- contrasts with → [[ADR calendario propio]] because la agenda sigue siendo de MOVE; Google solo bloquea turnos y recibe copias
