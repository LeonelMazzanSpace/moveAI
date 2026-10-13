import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { GENERATE_DAYS } from './schedule-fields.js';

export class GenerateSlotsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(GENERATE_DAYS.min)
  @Max(GENERATE_DAYS.max)
  days?: number;
}
