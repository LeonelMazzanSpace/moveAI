import { IsIn, IsInt, IsISO8601, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { CAPACITY, DATE_PATTERN, DURATION_MINUTES, SERVICES, START_TIME_PATTERN } from './schedule-fields.js';

export class CreateSlotDto {
  @IsIn(SERVICES)
  service: Service;

  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  date: string;

  @Matches(START_TIME_PATTERN)
  startTime: string;

  @IsInt()
  @Min(DURATION_MINUTES.min)
  @Max(DURATION_MINUTES.max)
  durationMinutes: number;

  @IsInt()
  @Min(CAPACITY.min)
  @Max(CAPACITY.max)
  capacity: number;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  professionalId?: string | null;
}
