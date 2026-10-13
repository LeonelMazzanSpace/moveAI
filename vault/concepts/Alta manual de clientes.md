---
type: concept
status: shipped
updated: 2026-10-13
source:
  - move/apps/api/src/modules/clients/dto/create-client.dto.ts
  - move/apps/api/src/modules/clients/services/clients.service.ts
  - move/apps/web/src/app/staff/clientes/nuevo/page.tsx
---
# Alta manual de clientes

"Nuevo cliente" del panel crea la cuenta con los datos personales y le manda al
cliente un email para definir su contraseña (D7). Plan y pago se registran aparte,
como pago manual.

## Structural
- is part of → [[Modulo clientes]]
