---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/calendar/services/calendar-sync.service.ts
  - move/apps/api/test/calendar.e2e-spec.ts
---
# Turnos bloqueados sin conexion de calendario

Una pasada de `calendar-pull` leía la conexión, esperaba a Google y recién después
escribía los bloqueos. Si en ese intervalo el staff desconectaba o la conexión pasaba a
`needs_reconnect`, la pasada escribía bloqueos que ya nadie iba a liberar: turnos de
Rehab no reservables sin calendario conectado (review T-061, I-1, reproducido). Los
e2e de "connection changes while a sync talks to Google" fijan el fix.
