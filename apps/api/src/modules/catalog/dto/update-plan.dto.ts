import { IsBoolean } from 'class-validator';
import {
  IntInRange, OptionalField, PLAN_LIMITS, PlanDescription, PlanFeatures, PlanName, PlanSlug,
} from './create-plan.dto.js';

// Every field is optional but never null; `service` and `kind` cannot change after creation.
export class UpdatePlanDto {
  @OptionalField()
  @PlanSlug()
  slug?: string;

  @OptionalField()
  @PlanName()
  name?: string;

  @OptionalField()
  @PlanDescription()
  description?: string;

  @OptionalField()
  @PlanFeatures()
  features?: string[];

  @OptionalField()
  @IntInRange(PLAN_LIMITS.price)
  price?: number;

  @OptionalField()
  @IntInRange(PLAN_LIMITS.periodMonths)
  periodMonths?: number;

  @OptionalField()
  @IntInRange(PLAN_LIMITS.periodDays)
  periodDays?: number;

  @OptionalField()
  @IntInRange(PLAN_LIMITS.sessionsIncluded)
  sessionsIncluded?: number;

  @OptionalField()
  @IntInRange(PLAN_LIMITS.durationMinutes)
  durationMinutes?: number;

  @OptionalField()
  @IsBoolean()
  featured?: boolean;

  @OptionalField()
  @IsBoolean()
  active?: boolean;

  @OptionalField()
  @IntInRange(PLAN_LIMITS.sortOrder)
  sortOrder?: number;
}
