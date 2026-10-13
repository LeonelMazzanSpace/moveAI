import type { Plan, PlanKind, Service } from '../entities/plan.entity.js';

// Same shape as `PlanDto` in the HTTP contract.
export type PlanModel = {
  id: string;
  service: Service;
  kind: PlanKind;
  slug: string;
  name: string;
  description: string;
  features: string[];
  price: number;
  currency: 'UYU';
  periodMonths: number | null;
  periodDays: number | null;
  sessionsIncluded: number | null;
  durationMinutes: number | null;
  featured: boolean;
  active: boolean;
  sortOrder: number;
};

export const toPlanDto = (plan: Plan): PlanModel => ({
  id: plan.id,
  service: plan.service,
  kind: plan.kind,
  slug: plan.slug,
  name: plan.name,
  description: plan.description,
  features: plan.features,
  price: plan.price,
  currency: 'UYU',
  periodMonths: plan.periodMonths,
  periodDays: plan.periodDays,
  sessionsIncluded: plan.sessionsIncluded,
  durationMinutes: plan.durationMinutes,
  featured: plan.featured,
  active: plan.active,
  sortOrder: plan.sortOrder,
});
