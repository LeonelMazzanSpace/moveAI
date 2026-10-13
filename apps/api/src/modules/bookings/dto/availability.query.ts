import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Matches, Max, Min } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { DATE_PATTERN, SERVICES } from '../../schedule/dto/schedule-fields.js';

export class AvailabilityQuery {
  @IsIn(SERVICES)
  service: Service;

  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  from: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days = 7;
}
