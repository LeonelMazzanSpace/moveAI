---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
  - move/docs/deploy.md
---
# MOC Plataforma y entrega

Monorepo, infraestructura, deploy y reglas transversales a todos los módulos.

## En el repo (shipped)
[[Monorepo MOVE]] · [[App web Next]] · [[API NestJS]] · [[Postgres local Docker]] ·
[[Modulo configuracion]] · [[Simulador de pagos de desarrollo]] · [[Manual de usuario]] ·
[[Pipeline CI Bitbucket]] · [[Suite E2E Playwright]]
Decisiones: [[ADR monorepo pnpm sin Turborepo]] · [[ADR Next App Router en lugar de Vite]] ·
[[ADR NestJS 12 en ESM]] · [[ADR TypeORM con migraciones por CLI]] ·
[[ADR Postgres en Docker para desarrollo]] · [[ADR shadcn base-nova sobre Base UI]] ·
[[ADR modulos simples por dominio]] (reemplaza a [[ADR arquitectura hexagonal por modulo]]) ·
[[ADR capa de datos del frontend]] · [[ADR desarrollo sin accesos a proveedores]] ·
[[ADR errores 4xx fuera de contrato como validacion]] · [[ADR un parser por variable de entorno]] ·
[[ADR suite E2E desktop y mobile]] (reemplaza a [[ADR sin E2E web de demos]]) · [[ADR sin archivos env nuevos]] ·
[[ADR manual de usuario con capturas]] · [[ADR manual con guia de proveedores]] ·
[[ADR menu movil en las tres areas]] · [[ADR errores de campo con copy propio]] ·
[[ADR slug de plan reutilizable tras borrado]]

## Producción (todo)
[[Vercel]] · [[AWS Elastic Beanstalk]] · [[Neon Postgres]], con [[ADR Vercel para la web]],
[[ADR Elastic Beanstalk para la API]], [[ADR Neon como base productiva]] y
[[ADR sin deploy en el run del MVP]]. Pendientes de deploy: [[Ambientes dev y produccion separados]],
[[Ambiente dev en dominio registrable propio]], [[PORT explicito en Elastic Beanstalk]],
[[IP real del cliente detras del proxy]], [[Rama dev de Neon sin expiracion]],
[[Bloqueo de IPs de Brevo resuelto antes de produccion]], [[ADR push a GitHub y merge por PR]].
La guía por consola está en la parte 4 del [[Manual de usuario]]; los comandos, en `docs/deploy.md`.

## Reglas transversales
- Backend: [[Esquema solo via migraciones]], [[Nombres snake_case en DB]], [[Variables de entorno validadas al arrancar]], [[Variable de entorno parseada una sola vez]], [[Validacion de entrada con DTOs]], [[CORS restringido a la web]], [[Imports relativos con extension js]], [[Dependencias entre modulos aciclicas]], [[Entidades ORM no salen del servicio]], [[Errores internos no expuestos]], [[Soft delete en datos de negocio]], [[Queries crudas con RETURNING via CTE]]
- Seguridad: [[Sin secretos en codigo]], [[Sin datos personales en logs]], [[Conexion SSL a la base en produccion]], [[Simulador de pagos solo fuera de produccion]]
- Frontend: [[Sistema visual MOVE]], [[Estilos via tokens del tema]], [[Paginas publicas renderizadas en servidor]], [[Helpers compartidos fuera de modulos use client]], [[Formularios validados con Zod]]
- Proceso: [[ADR alcance MVP en cuatro semanas]], [[Demo semanal de flujo visible]], [[Contrato front-back definido antes de implementar]], [[Sin infraestructura extra en MVP]], [[ADR zona horaria de negocio]]

## Lecciones del build
[[Config leida al importar antes de cargar el entorno]] · [[Variable de entorno parseada dos veces con reglas distintas]] ·
[[Throttling por IP ve la IP del proxy]] · [[Helper de modulo use client rompe un Server Component]] ·
[[Build de Next falla con NODE_ENV development]] · [[Guard muerto por UPDATE RETURNING sin CTE]]
Tanda de deuda técnica (T-039…T-054): [[Seed rompe con indice unico parcial]] · [[Mensajes de validacion en ingles visibles]] ·
[[Polling de pago sin tope ante errores]] · [[Menu movil se reabre al volver a la pagina]] ·
[[Variables del ejemplo filtran PORT a la web]] · [[Suite E2E escribe en una base real]]
Reglas nuevas: [[Pantallas sin scroll horizontal en mobile]] · [[Mensajes de validacion de la API no llegan al usuario]] ·
[[Suite E2E solo sobre su base propia]]
Riesgos de deploy: [[API inalcanzable detras del proxy de Elastic Beanstalk]] ·
[[Emails bloqueados por IP nueva en Brevo]] · [[Base de dev borrada por expiracion de rama Neon]]
