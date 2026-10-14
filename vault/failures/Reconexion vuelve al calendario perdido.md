---
type: failure
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/calendar/services/calendar-connection.service.ts
  - move/apps/api/test/calendar.e2e-spec.ts
---
# Reconexion vuelve al calendario perdido

Tras perder el calendario elegido (borrado o sin permiso), reconectar con la misma
cuenta de Google conservaba ese calendario: la conexión volvía a `connected`, la
pasada siguiente fallaba de nuevo y caía otra vez en `needs_reconnect`, y el segundo
aviso del día no salía por la clave del mail (review T-061 a2, I-1, reproducido).
