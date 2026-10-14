import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength } from 'class-validator';
import { PLAN_LIMITS, SLUG_PATTERN } from '../../catalog/domain/plan-rules.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

// The slug pattern also rejects blank values and NUL bytes before they reach Postgres.
export class CheckoutAutoDebitDto {
  @Transform(trim)
  @IsString()
  @MaxLength(PLAN_LIMITS.slugMax)
  @Matches(SLUG_PATTERN)
  planSlug: string;
}
