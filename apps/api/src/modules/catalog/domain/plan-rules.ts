import { AppError } from '../../../common/errors/app-error.js';
import type { PlanKind, Service } from '../entities/plan.entity.js';

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Ranges shared with the web settings form (D38).
export const PLAN_LIMITS = {
  name: { min: 2, max: 80 },
  slugMax: 80,
  descriptionMax: 500,
  featuresMax: 10,
  featureMax: 120,
  price: { min: 0, max: 10_000_000 },
  periodMonths: { min: 1, max: 36 },
  periodDays: { min: 1, max: 365 },
  sessionsIncluded: { min: 1, max: 100 },
  durationMinutes: { min: 15, max: 240 },
  sortOrder: { min: 0, max: 999 },
} as const;

export const isPlanSlug = (slug: string): boolean => slug.length <= PLAN_LIMITS.slugMax && SLUG_PATTERN.test(slug);

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
