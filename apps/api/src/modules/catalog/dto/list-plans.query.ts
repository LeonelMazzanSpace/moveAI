import { Transform } from 'class-transformer';
import { IsBoolean, IsIn } from 'class-validator';
import type { Service } from '../entities/plan.entity.js';
import { OptionalField, SERVICES } from './create-plan.dto.js';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListPlansQuery {
  @OptionalField()
  @IsIn(SERVICES)
  service?: Service;
}

export class ListStaffPlansQuery extends ListPlansQuery {
  @OptionalField()
  @Transform(toBoolean)
  @IsBoolean()
  includeInactive?: boolean;
}
