import { IsInt, Max, Min } from 'class-validator';
import { CAPACITY } from '../../schedule/dto/schedule-fields.js';

export class UpdateSlotCapacityDto {
  @IsInt()
  @Min(CAPACITY.min)
  @Max(CAPACITY.max)
  capacity: number;
}
