import { IsIn, IsOptional } from 'class-validator';
import type { Service } from '../../catalog/entities/plan.entity.js';
import { SERVICES } from './schedule-fields.js';

export class ListTemplatesQuery {
  @IsOptional()
  @IsIn(SERVICES)
  service?: Service;
}
