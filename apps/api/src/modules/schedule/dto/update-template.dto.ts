import { IsBoolean, IsInt, IsUUID, Matches, Max, Min, ValidateIf } from 'class-validator';
import { CAPACITY, DURATION_MINUTES, START_TIME_PATTERN } from './schedule-fields.js';

// Every column except `professional_id` is NOT NULL: a field may be omitted but never null.
// `professionalId: null` clears the professional.
export class UpdateTemplateDto {
  @ValidateIf((_, value) => value !== undefined)
  @Matches(START_TIME_PATTERN)
  startTime?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(DURATION_MINUTES.min)
  @Max(DURATION_MINUTES.max)
  durationMinutes?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(CAPACITY.min)
  @Max(CAPACITY.max)
  capacity?: number;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  professionalId?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
