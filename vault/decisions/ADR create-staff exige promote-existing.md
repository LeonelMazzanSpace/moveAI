---
type: decision
status: shipped
updated: 2026-10-13
source:
  - move/docs/superpowers/plans/2026-10-13-move-mvp.md
  - move/apps/api/src/cli/create-staff.ts
  - move/apps/api/test/create-staff.e2e-spec.ts
---
# ADR create-staff exige promote-existing

D54, del review transversal T-027 (I-2): `user:create-staff` sobre un email que ya
tiene cuenta falla salvo con `--promote-existing`; con el flag fija la contraseña dada,
revoca las sesiones, marca el email verificado y avisa que reutilizó la cuenta. Evita
convertir en staff una cuenta ajena por error. Una cuenta dada de baja nunca se
convierte (D72, sale con código 1), y el rol se cambia por `UsersService` dentro de una
transacción (T-051).

## Structural
- constrains → [[Modulo usuarios]]
