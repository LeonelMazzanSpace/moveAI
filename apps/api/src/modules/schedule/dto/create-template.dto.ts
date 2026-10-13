import { IsIn, IsInt, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { CAPACITY, DURATION_MINUTES, SERVICES, START_TIME_PATTERN, WEEKDAY } from './schedule-fields.js';

export class CreateTemplateDto {
  @IsIn(SERVICES)
  service: Service;

  @IsInt()
  @Min(WEEKDAY.min)
  @Max(WEEKDAY.max)
  weekday: number;

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
