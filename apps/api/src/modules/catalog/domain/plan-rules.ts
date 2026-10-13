import { AppError } from '../../../common/errors/app-error.js';
import type { PlanKind, Service } from '../entities/plan.entity.js';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type PlanShapeInput = {
  service: Service;
  kind: PlanKind;
  periodMonths: number | null;
  periodDays: number | null;
  sessionsIncluded: number | null;
  durationMinutes: number | null;
};

type ShapeField = 'periodMonths' | 'periodDays' | 'sessionsIncluded' | 'durationMinutes';

type KindRule = { service: Service; required: ShapeField[]; optional: ShapeField[] };

// Mirrors the CHECK constraints of `plans`; fields outside `required` and `optional` must be null.
const RULES: Record<PlanKind, KindRule> = {
  period_plan: { service: 'performance', required: ['periodMonths'], optional: [] },
  session_pack: { service: 'recovery', required: ['periodDays', 'sessionsIncluded'], optional: ['durationMinutes'] },
  single_session: { service: 'recovery', required: ['durationMinutes'], optional: [] },
  evaluation: { service: 'rehab', required: ['durationMinutes'], optional: [] },
};

const ALL_FIELDS: ShapeField[] = ['periodMonths', 'periodDays', 'sessionsIncluded', 'durationMinutes'];

const isPositive = (value: number | null): boolean => value !== null && value > 0;

export function validatePlanShape(input: PlanShapeInput): void {
  const rule = RULES[input.kind] as KindRule | undefined;
  if (!rule || rule.service !== input.service) throw new AppError('PLAN_KIND_INVALID');

  const allowed = [...rule.required, ...rule.optional];
  if (!rule.required.every((field) => isPositive(input[field]))) throw new AppError('PLAN_KIND_INVALID');
  if (rule.optional.some((field) => input[field] !== null && !isPositive(input[field]))) {
    throw new AppError('PLAN_KIND_INVALID');
  }
  if (ALL_FIELDS.some((field) => !allowed.includes(field) && input[field] !== null)) {
    throw new AppError('PLAN_KIND_INVALID');
  }
}
