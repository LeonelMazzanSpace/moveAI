---
type: moc
status: shipped
updated: 2026-10-13
source:
  - move/MOVE.pdf#p2
---
# MOC MOVE

Raíz del vault. MOVE es la reconstrucción de la plataforma de un centro de
Performance, Rehab y Recovery en Uruguay: pasa de un sitio informativo con reservas a
un sistema que conecta registro, planes, pagos, reservas, asistencia, seguimiento y
renovación. Ver [[Circuito principal MOVE]].

## Mapas
- [[MOC Roadmap MVP]]: qué se construyó cada semana y qué falta. Es el punto de entrada del orquestador.
- [[MOC Circuito Performance]]: espina 1, plan → pago → reserva → asistencia.
- [[MOC Pagos y activacion]]: espina 2, de Mercado Pago a plan activo.
- [[MOC Seguimiento y retencion]]: espina 3, de asistencia a alerta, contacto y renovación.
- [[MOC Identidad y acceso]]: espina 4, roles, Better Auth y cuenta creada en el flujo.
- [[MOC Rehab y Recovery]]: reservas pagas, disponibilidad y paquetes.
- [[MOC Plataforma y entrega]]: monorepo, infraestructura, deploy y reglas transversales.
- [[MOC Pantallas]]: cada mockup y su pantalla.

## Alcance de este vault
Modelado en profundidad: las cuatro espinas de arriba y la plataforma, más las
lecciones del build del MVP como fallas con su fix.
Deliberadamente no modelado:
- Contenido editorial del sitio (textos, fotos, ubicación).
- Precios reales: los de la semilla son provisorios.
- Planificaciones de entrenamiento e IA: fuera del MVP, ver [[IA y planificaciones fuera del MVP]].
- Detalle de cada endpoint: va en el contrato HTTP del plan, ver [[Contrato front-back definido antes de implementar]].
- Decisiones de orquestación del run (permisos de workers, archivos autorizados por tarea): quedan en el plan.
