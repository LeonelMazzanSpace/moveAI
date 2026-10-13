import { IsIn, IsISO8601, IsOptional, Matches } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { DATE_PATTERN, SERVICES } from '../../schedule/dto/schedule-fields.js';

export class ListStaffTimeSlotsQuery {
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  date: string;

  @IsOptional()
  @IsIn(SERVICES)
  service?: Service;
}
