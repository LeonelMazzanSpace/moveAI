---
type: system
status: shipped
semana: 3
updated: 2026-10-13
source:
  - move/apps/api/src/modules/clients/clients.module.ts
  - move/apps/api/src/modules/clients/services/clients.service.ts
  - move/apps/api/src/modules/clients/services/overview.service.ts
  - move/apps/api/src/modules/clients/domain/client-status.ts
---
# Modulo clientes

Vistas agregadas por cliente: lista y KPIs del staff, dashboard, detalle, alta manual
y el resumen del propio cliente (plan, reservas, historial y avisos). Calcula el
estado de cada cliente en memoria, suficiente para el volumen del MVP. Lee de casi
todos los módulos de dominio, por eso va al final del orden de dependencias.

## Structural
- is part of → [[API NestJS]]
- depends on → [[Modulo seguimiento]]
- depends on → [[Modulo pagos]]
- depends on → [[Modulo reservas]]
- depends on → [[Modulo suscripciones]]
