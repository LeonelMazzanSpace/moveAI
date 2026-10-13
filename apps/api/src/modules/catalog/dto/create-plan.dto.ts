import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsString, Length, Matches, Max, MaxLength, Min, NotContains, ValidateIf,
} from 'class-validator';
import { PLAN_LIMITS, SLUG_PATTERN } from '../domain/plan-rules.js';
import type { PlanKind, Service } from '../entities/plan.entity.js';

export const SERVICES: Service[] = ['performance', 'rehab', 'recovery'];
export const PLAN_KINDS: PlanKind[] = ['period_plan', 'session_pack', 'single_session', 'evaluation'];

// update-plan.dto.ts reads the limits from here.
export { PLAN_LIMITS };

// Postgres text cannot store NUL bytes: reject them at the edge instead of failing with a 500.
const NUL = '\u0000';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item)) : value;

// Skips validation only when the field is omitted: `null` still reaches the validators and fails.
export const OptionalField = () => ValidateIf((_, value) => value !== undefined);

export const IntInRange = (range: { min: number; max: number }) =>
  applyDecorators(IsInt(), Min(range.min), Max(range.max));

export const PlanSlug = () => applyDecorators(IsString(), MaxLength(PLAN_LIMITS.slugMax), Matches(SLUG_PATTERN));

export const PlanName = () =>
  applyDecorators(Transform(trim), IsString(), NotContains(NUL), Length(PLAN_LIMITS.name.min, PLAN_LIMITS.name.max));

export const PlanDescription = () =>
  applyDecorators(Transform(trim), IsString(), NotContains(NUL), MaxLength(PLAN_LIMITS.descriptionMax));

export const PlanFeatures = () =>
  applyDecorators(
    Transform(trimEach),
    IsArray(),
    ArrayMaxSize(PLAN_LIMITS.featuresMax),
    IsString({ each: true }),
    NotContains(NUL, { each: true }),
    Length(1, PLAN_LIMITS.featureMax, { each: true }),
  );

export class CreatePlanDto {
  @IsIn(SERVICES)
  service: Service;

  @IsIn(PLAN_KINDS)
  kind: PlanKind;

  @PlanSlug()
  slug: string;

  @PlanName()
  name: string;

  @OptionalField()
  @PlanDescription()
  description?: string;

  @OptionalField()
  @PlanFeatures()
  features?: string[];

  @IntInRange(PLAN_LIMITS.price)
  price: number;

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
