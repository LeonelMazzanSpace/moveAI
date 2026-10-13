---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p8
  - move/MOVE.pdf#p13
---
# MOC Plataforma y entrega

Monorepo, infraestructura y reglas transversales a todos los módulos.

## Hoy en el repo (shipped)
[[Monorepo MOVE]] · [[App web Next]] · [[API NestJS]] · [[Postgres local Docker]]
Decisiones: [[ADR monorepo pnpm sin Turborepo]] · [[ADR Next App Router en lugar de Vite]] ·
[[ADR NestJS 12 en ESM]] · [[ADR TypeORM con migraciones por CLI]] ·
[[ADR Postgres en Docker para desarrollo]] · [[ADR shadcn base-nova sobre Base UI]]

Acordada, se aplica con el primer módulo de dominio: [[ADR modulos simples por dominio]] (reemplaza a [[ADR arquitectura hexagonal por modulo]]).

## Producción (todo)
[[Vercel]] · [[AWS Elastic Beanstalk]] · [[Neon Postgres]], con [[ADR Vercel para la web]],
[[ADR Elastic Beanstalk para la API]] y [[ADR Neon como base productiva]]

## Reglas transversales
- Backend: [[Esquema solo via migraciones]], [[Nombres snake_case en DB]], [[Variables de entorno validadas al arrancar]], [[Validacion de entrada con DTOs]], [[CORS restringido a la web]], [[Imports relativos con extension js]], [[Dependencias entre modulos aciclicas]], [[Entidades ORM no salen del servicio]], [[Errores internos no expuestos]], [[Soft delete en datos de negocio]]
- Seguridad: [[Sin secretos en codigo]], [[Sin datos personales en logs]], [[Conexion SSL a la base en produccion]]
- Frontend: [[Sistema visual MOVE]], [[Estilos via tokens del tema]], [[Paginas publicas renderizadas en servidor]], [[Formularios validados con Zod]], [[ADR capa de datos del frontend]]
- Proceso: [[ADR alcance MVP en cuatro semanas]], [[Demo semanal de flujo visible]], [[Contrato front-back definido antes de implementar]], [[Sin infraestructura extra en MVP]], [[ADR zona horaria de negocio]]
