---
type: constraint
status: shipped
updated: 2026-10-14
source:
  - move/apps/api/src/modules/calendar/services/calendar-sync.service.ts
  - move/apps/api/src/modules/calendar/services/calendar-connection.service.ts
  - move/apps/api/test/calendar.e2e-spec.ts
---
# Conexion de calendario re-verificada antes de escribir

Después de esperar a Google (hasta 10 s por página), una pasada de sincronización
vuelve a leer la conexión con `FOR SHARE` dentro de la transacción que escribe, y solo
sigue si está conectada, sin borrar y con el mismo calendario. Desconectar, perder el
acceso o cambiar de calendario toman la misma fila con `FOR UPDATE`, así que esperan a
la pasada en curso y limpian lo que escribió (T-061). Un `invalid_grant` solo marca la
pérdida si la conexión conserva el token que usó la pasada (T-070).

## Structural
- constrains → [[Google Calendar]]
- prevents → [[Turnos bloqueados sin conexion de calendario]]

## Associative
- resembles → [[Reserva con bloqueo transaccional]]
