---
type: decision
status: shipped
updated: 2026-10-14
source:
  - move/docs/superpowers/specs/2026-10-14-move-feedback-design.md
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/modules/payments/services/auto-debits.service.ts
  - move/apps/api/src/modules/payments/entities/auto-debit.entity.ts
---
# ADR debito automatico con preapproval

D96, D97 y D108: los planes que el staff marca ("Permite débito automático"; semilla
Performance mensual y los dos packs Recovery) se pueden pagar con una suscripción
`preapproval` de Mercado Pago, que convive con el pago único. El monto queda fijo al
contratar, no hay pausa y cancelar deja vigente lo pagado. Con débito activo de
Performance no se vende un pago único de Performance (en Recovery sí); con un período
vigente, el primer cobro llega al día siguiente de su fin. Un cobro que llega para un
débito cancelado se aplica igual, porque el dinero ya se cobró.

## Structural
- constrains → [[Debito automatico]]
- establishes → [[Un debito activo por servicio]]
- establishes → [[Debito cancelado sigue conciliandose]]
