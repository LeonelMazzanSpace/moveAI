import { IsIn, IsISO8601, Matches } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { DATE_PATTERN, SERVICES } from '../../schedule/dto/schedule-fields.js';

export class ListTimeSlotsQuery {
  @IsIn(SERVICES)
  service: Service;

  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  date: string;
}
